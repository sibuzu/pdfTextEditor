# Directive: Process Image

## Goal
Process an uploaded image file (PNG, JPG) as a single-page document to allow editing within the same workflow as PDF.

## Inputs
- `file_path`: Absolute path to the source image file.
- `output_dir`: Directory to save the standardized page image.

## Tools/Scripts
- `execution/process_image.py`
    - Function: `process_single_image(file_path, output_dir)`
    - Library: `PIL` (Pillow)

## Steps
1.  **Validate Input**: Check if `file_path` exists and is a valid image (PNG/JPG).
2.  **Create Directory**: Ensure `output_dir` exists.
3.  **Standardize**:
    - Load image using `PIL`.
    - Drop Exif rotation if necessary (handled by PIL generally).
    - Convert to RGB to ensure compatibility.
    - Save as `page_0.png` to mimic the 0-indexed single-page PDF structure expected by the frontend/editor.
4.  **Return Metadata**:
    - Return list containing `['page_0.png']`.

## Edge Cases
- **CMYK Images**: Convert to RGB.
- **Corrupt Images**: Fail gracefully.
