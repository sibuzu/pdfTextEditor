import os
import glob
import re
from PIL import Image

def natural_sort_key(s):
    """Sort strings containing numbers naturally."""
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split('([0-9]+)', s)]

def create_pdf(session_dir: str, modifications: list) -> str:
    """
    Generate a new PDF by compiling the page images from the session directory.
    Note: 'modifications' argument is kept for signature compatibility but unused
    because the images in session_dir are already modified in-place by apply_edit.
    
    Args:
        session_dir: Session directory containing page images (page_*.png).
        modifications: Unused list of changes.
        
    Returns:
        Filename of the generated PDF (e.g., 'output.pdf').
    """
    print(f"Generating PDF in {session_dir}...")
    
    # 1. Find all page images
    # Pattern: page_0.png, page_1.png...
    image_pattern = os.path.join(session_dir, "page_*.png")
    image_paths = glob.glob(image_pattern)
    
    if not image_paths:
        raise FileNotFoundError("No page images found to generate PDF.")
        
    # 2. Sort them correctly (page_1 vs page_10)
    image_paths.sort(key=natural_sort_key)
    
    # 3. Load Images
    images = []
    for path in image_paths:
        img = Image.open(path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        images.append(img)
        
    if not images:
        raise ValueError("No images loaded.")
        
    # 4. Save as PDF
    output_filename = "output.pdf"
    output_path = os.path.join(session_dir, output_filename)
    
    # first image saves, others are appended
    images[0].save(
        output_path, "PDF", resolution=100.0, save_all=True, append_images=images[1:]
    )
    
    print(f"PDF saved to {output_path}")
    return output_filename

def create_image(session_dir: str, output_ext: str) -> str:
    """
    Export the single page image in the requested format.
    
    Args:
        session_dir: Session directory.
        output_ext: Target extension (e.g., '.jpg', '.png').
        
    Returns:
        Filename of the generated image.
    """
    image_path = os.path.join(session_dir, "page_0.png")
    if not os.path.exists(image_path):
        raise FileNotFoundError("Page image not found.")
        
    img = Image.open(image_path)
    
    output_filename = f"output{output_ext}"
    output_path = os.path.join(session_dir, output_filename)
    
    ext = output_ext.lower()
    if ext in [".jpg", ".jpeg"]:
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(output_path, "JPEG", quality=95)
    else:
        img.save(output_path, "PNG")
        
    print(f"Image saved to {output_path}")
    return output_filename
