FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install basic requirements
RUN pip install --no-cache-dir -U pip setuptools wheel

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies in specific order
RUN pip install --no-cache-dir numpy==1.24.3
RUN pip install --no-cache-dir fastapi==0.95.2 uvicorn==0.22.0
RUN pip install --no-cache-dir torch==2.0.1+cpu torchvision==0.15.2+cpu --extra-index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directory for CLIP
RUN mkdir -p /root/.cache/clip

# Copy the rest of the application
COPY . .

# Set environment variable to skip CLIP download prompt
ENV CLIP_SKIP_DOWNLOAD=1

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]