import os
import shutil
import logging
from PIL import Image, ImageDraw
try:
    from simple_lama_inpainting import SimpleLama
except ImportError:
    SimpleLama = None

logger = logging.getLogger(__name__)

_lama_model = None

def get_lama_model():
    global _lama_model
    if _lama_model is None:
        if SimpleLama is None:
            raise ImportError("simple-lama-inpainting not installed")
        logger.info("Loading LaMa model...")
        _lama_model = SimpleLama()
    return _lama_model

def apply_inpainting(image_path: str, bbox: list) -> str:
    """
    Inpaint the region specified by bbox in the image.
    Backs up the ORIGINAL image as {image_path}.original if not exists.
    Updates the image at image_path with the inpainted version.
    
    Args:
        image_path: Path to the image file (e.g., page_0.png).
        bbox: [x, y, w, h]
        
    Returns:
        The path to the updated image (same as input image_path).
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    # 1. Backup if not exists
    original_path = image_path + ".original"
    if not os.path.exists(original_path):
        logger.info(f"Creating backup for {image_path}")
        shutil.copy2(image_path, original_path)
    
    # 2. Load Image
    img = Image.open(image_path).convert("RGB")
    
    # 3. Create Mask
    # Mask should be same size, black background, white area to inpaint
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    
    x, y, w, h = bbox
    # Dilate mask slightly to ensure edges are covered? simple-lama might handle it.
    # Let's add small padding (e.g. 2px)
    pad = 5
    draw.rectangle([x - pad, y - pad, x + w + pad, y + h + pad], fill=255)
    
    # 4. Inpaint
    model = get_lama_model()
    result = model(img, mask)
    
    # 5. Save
    result.save(image_path)
    logger.info(f"Inpainted region {bbox} in {image_path}")
    
    return image_path

def restore_page(image_path: str):
    """
    Restore the page to its original state from backup.
    """
    original_path = image_path + ".original"
    if os.path.exists(original_path):
        shutil.copy2(original_path, image_path)
        logger.info(f"Restored {image_path} from backup")
    else:
        logger.warning(f"No backup found for {image_path}, cannot restore.")
