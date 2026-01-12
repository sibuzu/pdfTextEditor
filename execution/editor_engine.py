import logging
import os
import shutil
from typing import Tuple, List, Optional
from PIL import Image, ImageDraw, ImageFont

try:
    from simple_lama_inpainting import SimpleLama
except ImportError:
    SimpleLama = None

logger = logging.getLogger(__name__)

_lama_model = None

# Font Config
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "fonts")
DEFAULT_FONT = os.path.join(FONTS_DIR, "NotoSansTC-Regular.ttf")
ITALIC_FONT = os.path.join(FONTS_DIR, "Roboto-Italic.ttf")

def get_lama_model():
    global _lama_model
    if _lama_model is None:
        if SimpleLama is None:
            raise ImportError("simple-lama-inpainting not installed")
        logger.info("Loading LaMa model...")
        _lama_model = SimpleLama()
    return _lama_model

def get_optimal_font_scale(text: str, width: int, height: int, font_path: str) -> Tuple[ImageFont.FreeTypeFont, int]:
    """Calculate optimal font size to fit text within width/height."""
    size = 10  # Min size
    font = ImageFont.truetype(font_path, size)
    
    # Binary search or iterative increment would be better, but let's try iterative for simplicity and safety
    # Start with a guess based on height
    target_height_ratio = 0.8
    estimated_size = int(height * target_height_ratio)
    if estimated_size < size:
        estimated_size = size
        
    try:
        font = ImageFont.truetype(font_path, estimated_size)
    except OSError:
        # Fallback if font not found
        logger.warning(f"Font not found at {font_path}, using default.")
        font = ImageFont.load_default()
        return font, 10

    # Check width fit
    bbox = font.getbbox(text) # left, top, right, bottom
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    if text_width > width:
        # Scale down
        scale = width / text_width
        new_size = int(estimated_size * scale * 0.95) # 0.95 for padding
        if new_size < size:
            new_size = size
        font = ImageFont.truetype(font_path, new_size)
        
    return font, font.size

def apply_edit(image_path: str, bbox: list, text: str, is_italic: bool = False) -> str:
    """
    1. Inpaint the region (background removal).
    2. Draw new text.
    Backs up the ORIGINAL image as {image_path}.original if not exists.
    Updates the image at image_path with the edited version.
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
    
    # 3. Create Mask & Inpaint
    mask = Image.new("L", img.size, 0)
    draw_mask = ImageDraw.Draw(mask)
    x, y, w, h = [int(v) for v in bbox]
    pad = 5
    draw_mask.rectangle([x - pad, y - pad, x + w + pad, y + h + pad], fill=255)
    
    logger.info(f"Inpainting region {bbox}...")
    model = get_lama_model()
    img = model(img, mask) # Returns PIL Image
    
    # 4. Draw Text
    draw = ImageDraw.Draw(img)
    
    # Color: Default to black for now
    text_color = (0, 0, 0) 
    
    font_path = ITALIC_FONT if is_italic else DEFAULT_FONT
    font, font_size = get_optimal_font_scale(text, w, h, font_path)
    
    # Center text vertically/horizontally
    # getbbox returns (left, top, right, bottom) of the rendered text
    text_bbox = font.getbbox(text)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    
    text_x = x + (w - text_w) / 2
    # Vertically centering is tricky with fonts, usually ascent/descent stuff. 
    # Using simple center of bbox for now.
    text_y = y + (h - text_h) / 2 - text_bbox[1] # -text_bbox[1] shifts it down if top is negative
    
    logger.info(f"Drawing text: '{text}' | Font: {font_path} | Size: {font_size} | Color: {text_color} | Box: {bbox}")
    
    draw.text((text_x, text_y), text, font=font, fill=text_color)
    
    # 5. Save
    img.save(image_path)
    logger.info(f"Saved updated image: {image_path}")
    
    return image_path

# Alias for backward compatibility if needed, using empty text means just inpaint
def apply_inpainting(image_path: str, bbox: list) -> str:
    return apply_edit(image_path, bbox, "")

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
