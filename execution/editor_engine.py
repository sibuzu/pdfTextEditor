import logging
import os
import shutil
import threading
from typing import Tuple, List, Optional
from PIL import Image, ImageDraw, ImageFont

try:
    from simple_lama_inpainting import SimpleLama
except ImportError:
    SimpleLama = None

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_lama_model = None
_lama_lock = threading.Lock()

def apply_simple_fill(img: Image.Image, bbox: list, fill_color: Optional[str] = None) -> Image.Image:
    """
    Fills the bbox with a solid color.
    If fill_color is provided (hex), use it.
    Otherwise, calculate the average color of the 3px border surrounding the bbox.
    """
    x, y, w, h = [int(v) for v in bbox]
    draw = ImageDraw.Draw(img)
    
    if fill_color:
        # User specified color
        color = fill_color
    else:
        # Calculate average color of the border
        # Convert to numpy for easier calc
        img_np = np.array(img)
        # Handle RGB/RGBA
        if img_np.shape[2] == 4:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
            
        H, W = img_np.shape[:2]
        
        # Define border region bounds (3px padding)
        pad = 3
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(W, x + w + pad)
        y2 = min(H, y + h + pad)
        
        # Extract the patch including border
        patch = img_np[y1:y2, x1:x2]
        
        # Create a mask where border is 1, center (bbox) is 0
        mask = np.ones(patch.shape[:2], dtype=np.uint8)
        
        # Relative coordinates of the bbox inside the patch
        bx1 = x - x1
        by1 = y - y1
        bx2 = bx1 + w
        by2 = by1 + h
        
        # Ensure relative coords are valid
        bx1 = max(0, bx1); by1 = max(0, by1)
        bx2 = min(patch.shape[1], bx2); by2 = min(patch.shape[0], by2)
        
        # Zero out the center
        mask[by1:by2, bx1:bx2] = 0
        
        # Calculate mean of pixels where mask == 1
        mean_val = cv2.mean(patch, mask=mask)
        # mean_val is (R, G, B, 0)
        
        color = (int(mean_val[0]), int(mean_val[1]), int(mean_val[2]))
        
    logger.info(f"Simple-Filling {bbox} with color {color}")
    draw.rectangle([x, y, x+w, y+h], fill=color)
    
    return img

# Font Config
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "fonts")

FONT_MAP = {
    "NotoSansTC": {
        "regular": "NotoSansTC-Regular.ttf",
        "bold": "NotoSansTC-Bold.ttf"
    },
    "NotoSansJP": {
        "regular": "NotoSansJP-Regular.ttf",
        "bold": "NotoSansJP-Bold.ttf"
    },
    "NotoSansSC": {
        "regular": "NotoSansSC-Regular.ttf",
        "bold": "NotoSansSC-Bold.ttf"
    },
    "NotoSerifTC": {
        "regular": "NotoSerifTC-Regular.ttf",
        "bold": "NotoSerifTC-Bold.ttf"
    },
    "NotoSerif": {
        "regular": "NotoSerif-Regular.ttf",
        "bold": "NotoSerif-Bold.ttf",
        "italic": "NotoSerif-Italic.ttf"
    },
    "Roboto": {
        "regular": "Roboto-Regular.ttf",
        "bold": "Roboto-Bold.ttf",
        "italic": "Roboto-Italic.ttf"
    },
    "OpenSans": {
        "regular": "OpenSans-Regular.ttf",
        "bold": "OpenSans-Bold.ttf",
        "italic": "OpenSans-Italic.ttf"
    },
    "Tinos": {
        "regular": "Tinos-Regular.ttf",
        "bold": "Tinos-Bold.ttf",
        "italic": "Tinos-Italic.ttf"
    },
    "jf-openhuninn": {
        "regular": "jf-openhuninn-2.1.ttf",
        "bold": "jf-openhuninn-2.1.ttf" # No bold variant
    }
}

DEFAULT_FONT_FAMILY = "NotoSansTC"

def get_font_path(family: str, is_bold: bool, is_italic: bool) -> str:
    fam = FONT_MAP.get(family, FONT_MAP[DEFAULT_FONT_FAMILY])
    
    # Simple logic: If italic, prefer italic variant if exists. 
    # If bold, prefer bold. 
    # If both... well, we don't have BoldItalic for all, so prioritize Bold? or Italic? 
    # Let's prioritize Italic for now as it's a specific style user asked for, 
    # but ideally we need BoldItalic. 
    # Given the file list, we don't have BoldItalic for most.
    # Let's fallback: Bold takes precedence if we have to choose, or Italic?
    # User asked for "Italic, Bold, Size, Font".
    
    filename = fam.get("regular")
    if is_bold and "bold" in fam:
        filename = fam["bold"]
    elif is_italic and "italic" in fam:
        filename = fam["italic"]
        
    # Note: This means we can't do Bold + Italic simultaneously with current fonts.
    # That is acceptable for now.
    
    return os.path.join(FONTS_DIR, filename)

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
    
    target_height_ratio = 0.8
    estimated_size = int(height * target_height_ratio)
    if estimated_size < size:
        estimated_size = size
        
    try:
        font = ImageFont.truetype(font_path, estimated_size)
    except OSError:
        logger.warning(f"Font not found at {font_path}, using default.")
        font = ImageFont.load_default()
        return font, 10

    # Check width fit
    bbox = font.getbbox(text)
    text_width = bbox[2] - bbox[0]
    
    if text_width > width:
        scale = width / text_width
        new_size = int(estimated_size * scale * 0.95)
        if new_size < size:
            new_size = size
        font = ImageFont.truetype(font_path, new_size)
        
    return font, font.size

def apply_edit(image_path: str, bbox: list, text: str, 
               font_family: str = "NotoSansTC", 
               font_size: Optional[int] = None, 
               text_color: str = "#000000",
               is_bold: bool = False, 
               is_italic: bool = False,
               inpaint_method: str = "lama",
               fill_color: Optional[str] = None,
               restore_first: bool = False) -> str:
    """
    Applies text edit to the image.
    If restore_first is True, it re-copies from .original backup first.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    # 1. Backup / Restore
    original_path = image_path + ".original"
    if not os.path.exists(original_path):
        logger.info(f"Creating backup for {image_path}")
        shutil.copy2(image_path, original_path)
    
    if restore_first:
        shutil.copy2(original_path, image_path)
    
    # 2. Load Image
    img = Image.open(image_path).convert("RGB")
    
    # 3. Inpaint (Background Removal)
    # Only inpaint if we have text to write or if we explicitly want to clear the area
    # Even if empty text, we probably want to clear the old text (inpaint).
    
    mask = Image.new("L", img.size, 0)
    draw_mask = ImageDraw.Draw(mask)
    x, y, w, h = [int(v) for v in bbox]
    pad = 5
    draw_mask.rectangle([x - pad, y - pad, x + w + pad, y + h + pad], fill=255)
    
    model = get_lama_model()
    
    if inpaint_method == "simple_filled":
        img = apply_simple_fill(img, bbox, fill_color)
    else:
        # Default LaMa
        logger.info(f"Inpainting region {bbox} with LaMa...")
        # Lock for thread safety during inference
        with _lama_lock:
            img = model(img, mask) 

    # 4. Draw Text
    draw = ImageDraw.Draw(img)
    # text_color is passed as arg
    
    font_path = get_font_path(font_family, is_bold, is_italic)
    
    # Calculate Font Scale Factor
    # Base scale is 1.1 (to make text slightly larger by default), multiplied by User Factor
    base_factor = 1.1
    user_factor = 1.0
    
    if font_size is not None:
        try:
            if isinstance(font_size, str) and font_size.strip().endswith("%"):
                user_factor = float(font_size.strip().rstrip("%")) / 100.0
            elif isinstance(font_size, (int, float)):
                 # User rule: number interpreted as % (e.g. 100 -> 1.0)
                user_factor = float(font_size) / 100.0
            
            # Sanity check
            if user_factor <= 0:
                user_factor = 1.0
        except ValueError:
            user_factor = 1.0
            logger.warning(f"Invalid font_size format: {font_size}, defaulting to 100%")

    final_scale_factor = base_factor * user_factor

    # Calculate Scaled Diagram Dimensions (for font fitting only)
    # The physical area we draw into (for centering) is still (x, y, w, h)
    # But we tell the font optimizer we have (w * scale, h * scale) space.
    
    scaled_w = int(w * final_scale_factor)
    scaled_h = int(h * final_scale_factor)
    
    # Use the optimized font scale logic with SCALED dimensions
    font, final_size = get_optimal_font_scale(text, scaled_w, scaled_h, font_path)
    
    text_bbox = font.getbbox(text)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    
    text_x = x + (w - text_w) / 2
    text_y = y + (h - text_h) / 2 - text_bbox[1]
    
    logger.info(f"Drawing: '{text}' | Fam: {font_family} | Size{final_size} | Color:{text_color} | B:{is_bold} I:{is_italic}")
    
    draw.text((text_x, text_y), text, font=font, fill=text_color)
    
    # 5. Save
    img.save(image_path)
    return image_path

def restore_page(image_path: str):
    original_path = image_path + ".original"
    if os.path.exists(original_path):
        shutil.copy2(original_path, image_path)
    else:
        logger.warning(f"No backup found.")

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
