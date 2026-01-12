# Directive: Edit Page Content
## Goal
Modify the content of a page image by removing original text (Inpainting) and rendering new text (Text Rendering).

## Inputs
- `image_path`: Path to the page image.
- `bbox`: Bounding box of the text region `[x, y, w, h]`.
- `text`: New text to render.
- `is_italic`: Boolean flag for italic styling.

## Tools/Scripts
- `execution/editor_engine.py`

## Steps
1.  **Backup**: Ensure `{image_path}.original` exists. If not, copy `image_path` to it.
2.  **Inpainting (Visual Feedback)**:
    - Create a binary mask from `bbox` (white on black, with small padding).
    - Load `simple-lama-inpainting` model.
    - Process the image + mask to remove the text/objects in the region.
3.  **Text Rendering**:
    - Calculate optimal font height to fit the `bbox` height (iterative or estimated).
    - Select Font:
        - Default: `NataSansTC-Regular.ttf` (CJK support).
        - If `is_italic=True`: Use `Roboto-Italic.ttf` (or configured italic font).
    - Draw text centered in the `bbox`.
    - Save the modified image back to `image_path`.
    - Return the path/URL.

## Restore Logic
- Function: `restore_page(image_path)`
- Action:
    1. Check if `{image_path}.original` exists.
    2. Overwrite `image_path` with the original copy.
