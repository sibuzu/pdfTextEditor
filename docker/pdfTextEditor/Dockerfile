# Use NVIDIA CUDA 12.8 base image (Ubuntu 24.04 preferred for Python 3.12)
# If 12.8.0-base-ubuntu24.04 is not available, user may need to adjust tag.
FROM nvidia/cuda:12.8.0-cudnn-devel-ubuntu24.04

# Set non-interactive installation
ENV DEBIAN_FRONTEND=noninteractive

# Update system and install Python 3.12 and dependencies
# Ubuntu 24.04 ships with Python 3.12
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage cache
# We assume directives are to copy from project root
COPY requirements.txt .

# Install dependencies
# 1. Install regular dependencies
# 2. Install PyTorch with CUDA 12.8 support
# 3. Install simple-lama-inpainting without dependencies to avoid Pillow conflict
RUN pip3 install --no-cache-dir --break-system-packages "paddlepaddle>=2.6.0" "paddleocr>=2.7.0" && \
    pip3 install --no-cache-dir --break-system-packages --extra-index-url https://download.pytorch.org/whl/cu128 \
    "torch==2.9.1+cu128" "torchvision==0.24.1+cu128" "torchaudio==2.9.1+cu128" && \
    pip3 install --no-cache-dir --break-system-packages -r requirements.txt && \
    pip3 install --no-cache-dir --break-system-packages simple-lama-inpainting --no-deps

# Preload Models (PaddleOCR & LaMa)
# Copy script specifically to cache this layer
# COPY docker/pdfTextEditor/preload_models.py .
# RUN export CUDA_VISIBLE_DEVICES="" && python3 preload_models.py && rm preload_models.py

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run command
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
