FROM ubuntu:latest

# Install required packages
RUN apt-get update && apt-get install -y \
    texlive-full \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy Python API files
COPY . .

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir fastapi uvicorn python-multipart

# Expose port
EXPOSE 8080

# Start the FastAPI server
CMD ["/opt/venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
