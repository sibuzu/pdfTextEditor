# Directive: Process PDF

## Goal
Convert an uploaded PDF file into a series of images (one per page) to facilitate display and OCR analysis.

## Inputs
- `pdf_path`: Absolute path to the source PDF file.
- `output_dir`: Directory to save the generated images.

## Tools/Scripts
- `execution/process_pdf.py` (to be created)
    - Function: `convert_pdf_to_images(pdf_path, output_dir)`

## Steps
1.  **Validate Input**: Check if `pdf_path` exists and is a valid PDF.
2.  **Create Directory**: Ensure `output_dir` exists.
3.  **Convert**:
    - Use `pdf2image` (or similar library) to convert each page of the PDF into a high-quality image (e.g., PNG or JPEG).
    - Resolution should be sufficient for OCR (e.g., 300 DPI).
4.  **Save Output**:
    - Naming convention: `page_{page_number}.png` (0-indexed or 1-indexed, be consistent).
5.  **Return Metadata**:
    - Return a list of generated image paths or a JSON object describing the result (e.g., `{page_count: 5, images: [...]}`).

## Edge Cases
- **Encrypted PDFs**: Should either fail gracefully or prompt for password (fail for now).
- **Corrupt PDFs**: Handle exceptions and return error.
- **Large Files**: Limit processing to reasonably sized PDFs (e.g., < 20 pages as per UI hint) or handle pagination.
