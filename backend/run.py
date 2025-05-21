import uvicorn
import os
from dotenv import load_dotenv
from pathlib import Path

# Create uploads directory
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Create documents directory
documents_dir = Path("documents")
documents_dir.mkdir(exist_ok=True)

# Create subdirectories
for subdir in ["profile_pictures", "documents"]:
    (uploads_dir / subdir).mkdir(exist_ok=True)

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    
    # Run the application
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    ) 