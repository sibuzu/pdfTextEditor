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
1.  **Iterate Pages**: For each page in the session.
2.  **Load Image**: Load the corresponding image from `.tmp/` directory. (Note: These images are already modified by `editor_engine` with inpainting/text).
3.  **Compile**:
    - Use `PIL` or `img2pdf` to convert images to a single PDF.
4.  **Return**: Path to the generated PDF.

## Edge Cases
- **Text Overflow**: If new text is longer than the box, decrease font size or wrap? (Simple scaling for now).
- **Font Missing**: Fallback to standard fonts.
