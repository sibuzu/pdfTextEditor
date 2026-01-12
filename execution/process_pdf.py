import fitz  # PyMuPDF
import os
import logging
from typing import List

logger = logging.getLogger(__name__)

def convert_pdf_to_images(pdf_path: str, output_dir: str) -> List[str]:
    """
    Convert a PDF file to a list of images (one per page) using PyMuPDF.
    
    Args:
        pdf_path: Absolute path to the PDF file.
        output_dir: Directory to save the images.
        
    Returns:
        List of filenames of the generated images.
    """
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        logger.info(f"Converting PDF: {pdf_path} to images in {output_dir}")
        
        doc = fitz.open(pdf_path)
        image_paths = []

        for i in range(len(doc)):
            page = doc.load_page(i)  # number of page
            pix = page.get_pixmap(dpi=200) # render page to an image
            
            image_filename = f"page_{i}.png"
            image_path = os.path.join(output_dir, image_filename)
            
            pix.save(image_path)
            image_paths.append(image_filename)
            
        doc.close()
        logger.info(f"Generated {len(image_paths)} images.")
        return image_paths
        
    except Exception as e:
        logger.error(f"Error converting PDF: {e}")
        raise e

