FROM python:3.11-slim

# System dependencies required by OpenCV and video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    # ffmpeg is needed by OpenCV for video file decoding (mp4, avi, etc.)
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

EXPOSE 8000

# Models should be mounted as a volume or downloaded at runtime;
# they are excluded from the image via .dockerignore.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
