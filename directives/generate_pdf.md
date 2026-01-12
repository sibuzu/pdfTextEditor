# Directive: Generate PDF

## Goal
Create a new PDF based on the original structure but replacing specific text blocks with new user-defined text.

## Inputs
- `original_pdf_path`: (Optional) If we want to use the original as background.
- `page_images`: List of background images for each page.
- `text_modifications`: Data structure containing the new text for each block.
    - Key: `page_index`
    - Value: List of `{bbox, text, font_settings}`.

## Tools/Scripts
- `execution/generate_pdf.py` (to be created)

## Steps
1.  **Iterate Pages**: For each page in the document.
2.  **Prepare Canvas**:
    - Use `reportlab` or `fpdf`.
    - Set the page size to match the original image/PDF.
3.  **Draw Background**:
    - Place the original page image as the background.
    - **Crucial**: We need to "erase" the original text if we are just overlaying.
    - *Better Approach*:
        - **Option A**: Use a VLM or Inpainting tool to "clean" the text from the background image first. (Complex).
        - **Option B** (Simpler): Draw a white (or background-colored) rectangle over the original bbox before writing the new text.
4.  **Draw Text**:
    - For each text block in `text_modifications`:
        - Calculate position from `bbox`.
        - Select font (try to match logical style or use default).
        - Draw string.
5.  **Compile**: Save all pages into a single PDF.
6.  **Return**: Path to the generated PDF.

## Edge Cases
- **Text Overflow**: If new text is longer than the box, decrease font size or wrap? (Simple scaling for now).
- **Font Missing**: Fallback to standard fonts.
