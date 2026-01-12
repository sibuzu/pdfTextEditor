import os
from PIL import Image
from typing import List

def process_single_image(file_path: str, output_dir: str) -> List[str]:
    """
    Process a single image file (PNG/JPG) as a one-page document.
    Converts the image to 'page_0.png' in the output directory.
    
    Args:
        file_path: Path to the input image.
        output_dir: Directory to save the page image.
        
    Returns:
        List of filenames (e.g. ['page_0.png']).
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # We enforce conversion to PNG for internal consistency with the editor pipeline
    # (server.py assumes .png for pages)
    target_filename = "page_0.png"
    target_path = os.path.join(output_dir, target_filename)
    
    with Image.open(file_path) as img:
        # Ensure RGB if saving as PNG/JPG to avoid mode issues (e.g. CMYK)
        if img.mode in ('CMYK', 'P'):
            img = img.convert('RGB')
        img.save(target_path, "PNG")
    
    return [target_filename]
