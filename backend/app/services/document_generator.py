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
    
    # Extract alumni data with defaults in case fields are missing
    full_name = alumni_data.get("full_name", "")
    student_id = alumni_data.get("student_id", "")
    course = alumni_data.get("course", "")
    graduation_year = alumni_data.get("graduation_year", datetime.now().year)
    
    # Format main content
    c.setFont("Helvetica", 12)
    text_y = height - 310
    
    # First paragraph
    c.drawString(72, text_y, f"This is to certify that {full_name} is a Bachelor of")
    text_y -= 20
    c.drawString(72, text_y, f"{course} student at Cavite State University – Carmona. 1st")
    text_y -= 20
    c.drawString(72, text_y, f"Semester Academic Year {graduation_year-1}-{graduation_year} to 1st Semester Academic Year {graduation_year}-{graduation_year+1}")
    text_y -= 20
    c.drawString(72, text_y, "only.")
    
    # Second paragraph
    text_y -= 40
    c.drawString(72, text_y, "This moreover certifies that she possesses good moral character and")
    text_y -= 20
    c.drawString(72, text_y, "has not been subjected to any major disciplinary action throughout the")
    text_y -= 20
    c.drawString(72, text_y, "duration of her stay in the school.")
    
    # Third paragraph
    last_name = full_name.split()[-1] if full_name else ""
    text_y -= 40
    c.drawString(72, text_y, f"This certification is being issued upon the request of Ms. {last_name} for")
    text_y -= 20
    c.drawString(72, text_y, "whatever legal purpose it may serve.")
    
    # Date
    today = datetime.utcnow()
    day = today.day
    suffix = "th"
    if day == 1 or day == 21 or day == 31:
        suffix = "st"
    elif day == 2 or day == 22:
        suffix = "nd"
    elif day == 3 or day == 23:
        suffix = "rd"
    
    text_y -= 40
    c.drawString(72, text_y, f"Given this {day}{suffix} day of {today.strftime('%B %Y')}")
    
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
    # Use the same template as good moral for now
    # We can customize further as needed
    return await generate_good_moral(alumni_data)

async def generate_enrollment_certificate(alumni_data):
    """
    Generate an Enrollment Certificate for the alumni
    """
    # Use the same template as good moral for now
    # We can customize further as needed
    return await generate_good_moral(alumni_data)

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