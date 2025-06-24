from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from datetime import datetime
import os
import hashlib

async def generate_document_from_template(document_type, alumni_data):
    """
    Generate a document based on the template type and alumni data
    """
    if document_type == "good_moral":
        return await generate_good_moral(alumni_data)
    elif document_type == "certification":
        return await generate_certification(alumni_data)
    elif document_type == "enrollment":
        return await generate_enrollment_certificate(alumni_data)
    else:
        raise ValueError(f"Unsupported document type: {document_type}")

async def generate_good_moral(alumni_data):
    """
    Generate a Good Moral Certificate for the alumni
    """
    # Create directory for generated documents
    output_dir = "uploads/documents/generated"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"good_moral_{alumni_data['_id']}_{timestamp}.pdf"
    file_path = os.path.join(output_dir, filename)
    
    # Create PDF
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter
    
    # Add header with logo and university name
    # Check if logo exists, if not, just add text
    logo_path = "static/templates/cvsu_logo.png"
    if os.path.exists(logo_path):
        c.drawImage(logo_path, width/2 - 40, height - 120, 80, 80)
    
    # Add header text
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 150, "Republic of the Philippines")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, height - 170, "CAVITE STATE UNIVERSITY")
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 190, "Carmona Campus")
    c.drawCentredString(width/2, height - 210, "Maduya, Carmona, Cavite")
    
    # Add certification title
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 260, "C E R T I F I C A T I O N")
    
    # Format main content with text aligned in blocks
    c.setFont("Helvetica", 12)
    text_y = height - 310
    
    # Hard-coded content - we'll use text blocks to better align the text
    
    # First paragraph - break into multiple lines for better alignment
    c.drawString(72, text_y, "This is to certify that rod is a Bachelor of Bachelor of Science in Computer")
    text_y -= 20
    c.drawString(72, text_y, "Science student at Cavite State University – Carmona. 1st Semester Academic")
    text_y -= 20
    c.drawString(72, text_y, "Year 2000-2001 to 1st Semester Academic Year 2001-2002 only.")
    
    # Second paragraph - break into multiple lines for better alignment
    text_y -= 40
    c.drawString(72, text_y, "This moreover certifies that she possesses good moral character and has not")
    text_y -= 20
    c.drawString(72, text_y, "been subjected to any major disciplinary action throughout the duration of her")
    text_y -= 20
    c.drawString(72, text_y, "stay in the school.")
    
    # Third paragraph - break into multiple lines for better alignment
    text_y -= 40
    c.drawString(72, text_y, "This certification is being issued upon the request of Ms. rod for whatever")
    text_y -= 20
    c.drawString(72, text_y, "legal purpose it may serve.")
    
    # Date - hard coded
    text_y -= 40
    c.drawString(72, text_y, "Given this 14th day of May 2025")
    
    # Signatory
    text_y -= 80
    c.drawString(width - 250, text_y, "RON ERIK C. FRONTUNA")
    text_y -= 20
    c.drawString(width - 250, text_y, "Guidance Facilitator")
    
    # Add document stamp if available
    stamp_path = "static/templates/document_stamp.png"
    if os.path.exists(stamp_path):
        c.drawImage(stamp_path, 100, 100, 200, 100)
    
    c.save()
    
    # Return relative path for storage in database
    return f"documents/generated/{filename}"

async def generate_certification(alumni_data):
    """
    Generate a General Certification for the alumni
    """
    # Create directory for generated documents
    output_dir = "uploads/documents/generated"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"certification_{alumni_data['_id']}_{timestamp}.pdf"
    file_path = os.path.join(output_dir, filename)
    
    # Create PDF
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter
    
    # Add header with logo and university name
    # Check if logo exists, if not, just add text
    logo_path = "static/templates/cvsu_logo.png"
    if os.path.exists(logo_path):
        c.drawImage(logo_path, width/2 - 40, height - 120, 80, 80)
    
    # Add header text
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 150, "Republic of the Philippines")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, height - 170, "CAVITE STATE UNIVERSITY")
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 190, "Carmona Campus")
    c.drawCentredString(width/2, height - 210, "Maduya, Carmona, Cavite")
    
    # Add certification title
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 260, "G E N E R A L   C E R T I F I C A T I O N")
    
    # Format main content with text aligned in blocks
    c.setFont("Helvetica", 12)
    text_y = height - 310
    
    # Hard-coded content - we'll use text blocks to better align the text
    
    # First paragraph - break into multiple lines for better alignment
    c.drawString(72, text_y, "This is to certify that rod, with Student ID #20000001, is a graduate of")
    text_y -= 20
    c.drawString(72, text_y, "Bachelor of Science in Computer Science from Cavite State University – Carmona")
    text_y -= 20
    c.drawString(72, text_y, "Campus, having successfully completed all academic requirements in")
    text_y -= 20
    c.drawString(72, text_y, "Academic Year 2000-2001.")
    
    # Second paragraph - break into multiple lines for better alignment
    text_y -= 40
    c.drawString(72, text_y, "This certification is being issued for employment purposes and whatever legal")
    text_y -= 20
    c.drawString(72, text_y, "purpose it may serve.")
    
    # Date - hard coded
    text_y -= 40
    c.drawString(72, text_y, "Given this 14th day of May 2025")
    
    # Signatory
    text_y -= 80
    c.drawString(width - 250, text_y, "MARIA S. SANTOS")
    text_y -= 20
    c.drawString(width - 250, text_y, "University Registrar")
    
    # Add document stamp if available
    stamp_path = "static/templates/document_stamp.png"
    if os.path.exists(stamp_path):
        c.drawImage(stamp_path, 100, 100, 200, 100)
    
    c.save()
    
    # Return relative path for storage in database
    return f"documents/generated/{filename}"

async def generate_enrollment_certificate(alumni_data):
    """
    Generate an Enrollment Certificate for the alumni
    """
    # Create directory for generated documents
    output_dir = "uploads/documents/generated"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"enrollment_{alumni_data['_id']}_{timestamp}.pdf"
    file_path = os.path.join(output_dir, filename)
    
    # Create PDF
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter
    
    # Add header with logo and university name
    # Check if logo exists, if not, just add text
    logo_path = "static/templates/cvsu_logo.png"
    if os.path.exists(logo_path):
        c.drawImage(logo_path, width/2 - 40, height - 120, 80, 80)
    
    # Add header text
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 150, "Republic of the Philippines")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, height - 170, "CAVITE STATE UNIVERSITY")
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 190, "Carmona Campus")
    c.drawCentredString(width/2, height - 210, "Maduya, Carmona, Cavite")
    
    # Add certification title
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 260, "E N R O L L M E N T   C E R T I F I C A T E")
    
    # Format main content with text aligned in blocks
    c.setFont("Helvetica", 12)
    text_y = height - 310
    
    # Hard-coded content - we'll use text blocks to better alignment
    
    # First paragraph - break into multiple lines for better alignment
    c.drawString(72, text_y, "This is to certify that rod, with Student ID #20000001, is currently enrolled")
    text_y -= 20
    c.drawString(72, text_y, "as a 4th Year student in the Bachelor of Science in Computer Science program")
    text_y -= 20
    c.drawString(72, text_y, "at Cavite State University – Carmona Campus for the 1st Semester of Academic")
    text_y -= 20
    c.drawString(72, text_y, "Year 2000-2001.")
    
    # Second paragraph - break into multiple lines for better alignment
    text_y -= 40
    c.drawString(72, text_y, "The student is in good academic standing and is expected to complete all")
    text_y -= 20
    c.drawString(72, text_y, "requirements for graduation by the end of this academic year.")
    
    # Third paragraph - break into multiple lines for better alignment
    text_y -= 40
    c.drawString(72, text_y, "This certification is being issued upon the request of the student for")
    text_y -= 20
    c.drawString(72, text_y, "scholarship application and whatever legal purpose it may serve.")
    
    # Date - hard coded
    text_y -= 40
    c.drawString(72, text_y, "Given this 14th day of May 2025")
    
    # Signatory
    text_y -= 80
    c.drawString(width - 250, text_y, "ELENA R. DELA CRUZ")
    text_y -= 20
    c.drawString(width - 250, text_y, "College Secretary")
    
    # Add document stamp if available
    stamp_path = "static/templates/document_stamp.png"
    if os.path.exists(stamp_path):
        c.drawImage(stamp_path, 100, 100, 200, 100)
    
    c.save()
    
    # Return relative path for storage in database
    return f"documents/generated/{filename}"

def calculate_document_hash(file_path):
    """
    Calculate SHA-256 hash of a document file
    """
    # Check if file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Calculate hash
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read in chunks to handle large files
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    return sha256_hash.hexdigest() 