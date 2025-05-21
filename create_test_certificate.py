from PIL import Image, ImageDraw, ImageFont
import os

def create_test_certificate():
    """Create a test certificate image file for the missing document"""
    # Set the path for missing file
    file_path = "uploads/68236de4d8d6f1393876b840/certificate_3e4f207a-57c1-47d5-a503-d01251ebd786.png"
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Create a blank image with white background
    width, height = 800, 600
    image = Image.new('RGB', (width, height), (255, 255, 255))
    
    # Get a drawing context
    draw = ImageDraw.Draw(image)
    
    # Draw a border
    draw.rectangle([(20, 20), (width-20, height-20)], outline=(0, 100, 0), width=2)
    
    # Add text
    try:
        # Try to use a font if available
        font = ImageFont.truetype("arial.ttf", 32)
        small_font = ImageFont.truetype("arial.ttf", 20)
    except IOError:
        # Fallback to default font
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    # Draw title
    draw.text((width//2, 100), "Certificate", fill=(0, 100, 0), font=font, anchor="mm")
    
    # Draw content
    draw.text((width//2, height//2), "This is a test certificate", fill=(0, 0, 0), font=small_font, anchor="mm")
    draw.text((width//2, height//2 + 40), "Created for testing purposes", fill=(0, 0, 0), font=small_font, anchor="mm")
    
    # Draw date
    draw.text((width//2, height-100), "Date: May 15, 2024", fill=(0, 0, 0), font=small_font, anchor="mm")
    
    # Save the image
    image.save(file_path)
    print(f"Created test certificate at {file_path}")

if __name__ == "__main__":
    create_test_certificate() 