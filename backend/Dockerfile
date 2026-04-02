# CVSU Alumni System Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/config/fabric
RUN mkdir -p /app/wallet
RUN mkdir -p /app/uploads

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Health check (use Python stdlib to avoid installing curl)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request,sys; \
opener=urllib.request.build_opener(); \
opener.addheaders=[('User-Agent','healthcheck')]; \
urllib.request.install_opener(opener); \
sys.exit(0) if urllib.request.urlopen('http://localhost:8000/health').getcode()<400 else sys.exit(1)" || exit 1

# Run the application
CMD ["python", "run.py"]


