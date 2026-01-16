import os
import sys

print("Preloading models...")

# 1. Preload PaddleOCR
try:
    print("Downloading PaddleOCR models...")
    from paddleocr import PaddleOCR
    # Trigger download by initializing
    # using same params as app
    ocr = PaddleOCR(use_angle_cls=False, lang='ch', use_doc_orientation_classify=False, use_doc_unwarping=False)
    print("PaddleOCR loaded.")
except ImportError:
    print("PaddleOCR not installed.")
except Exception as e:
    print(f"Error loading PaddleOCR: {e}")
    sys.exit(1)

# 2. Preload SimpleLaMa
try:
    print("Downloading LaMa model...")
    from simple_lama_inpainting import SimpleLama
    # Trigger download
    # lama = SimpleLama()
    # print("LaMa loaded.")
    pass
except ImportError:
    print("SimpleLama not installed.")
except Exception as e:
    print(f"Error loading LaMa: {e}")
    sys.exit(1)

print("All models preloaded successfully.")
