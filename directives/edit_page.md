# Directive: Edit Page Content

## Goal
Modify the content of a page image by completely rebuilding it from the original state. This supports "Undo" and consistent rendering.

## Inputs
- `image_path`: Path to the page image.
- `edits`: List of Edit Specifications for the page. Each edit contains:
    - `bbox`: `[x, y, w, h]`
    - `text`: New text
    - `font_family`: Enum (NotoSansTC, Roboto, etc.)
    - `font_size`: Integer (optional, auto-scale if None)
    - `is_bold`: Boolean
    - `is_italic`: Boolean

## Tools/Scripts
- `execution/editor_engine.py`

## Steps
1.  **Restore**: Always call `restore_page(image_path)` first to revert to the clean original.
2.  **Apply All Edits**: Iterate through the list of `edits`. for each edit:
    - **Backups**: (Handled by `restore_page`, `apply_edit` with `restore_first=False`).
    - **Inpainting**: Remove text in `bbox` using SimpleLama.
    - **Text Rendering**:
        - Select Font: Use `FONT_MAP` to find the correct .ttf file based on Family + Bold + Italic.
        - Calculate Size: Use provided `font_size` or Auto-calculate height to fit bbox.
        - Draw Text: Render text using PIL.

## Font Logic (`FONT_MAP`)
- Supports: NotoSansTC, NotoSansSC, NotoSansJP, NotoSerifTC, NotoSerif, Roboto, OpenSans, Tinos, jf-openhuninn.
- Fallbacks: If "Bold Italic" missing, prioritize Italic, then Bold.

## Restore Logic
- Function: `restore_page(image_path)`
- Action: Overwrite `image_path` with `{image_path}.original`.
