# Directive: Web Server

## Goal
Serve the HTML frontend and provide API endpoints to Orchestrate the PDF processing workflow.

## Inputs
- `host`: 0.0.0.0
- `port`: 8000

## Tools/Scripts
- `server.py` (FastAPI)

## Endpoints
1.  **`GET /`**: Serve `templates/index.html`.
2.  **`POST /upload`**:
    - **Input**: `file` (UploadFile).
    - **Action**: Save, Convert PDF to Images, Generate Session ID.
    - **Output**: JSON `{session_id, pages: [...]}`.
3.  **`POST /analyze`**:
    - **Input**: `{session_id, page_index}`.
    - **Action**: OCR Analysis.
    - **Output**: JSON `{blocks: [...]}`.
4.  **`POST /update-page`** (Primary Editing Endpoint):
    - **Input**: `{session_id, page_index, edits: [EditSpec]}`.
    - **EditSpec**: `{bbox, text, font_family, font_size, is_bold, is_italic}`.
    - **Action**:
        - Restore original image.
        - Iteratively Apply all `edits` (Inpaint + Render).
    - **Output**: JSON `{image_url}`.
5.  **`POST /generate`**:
    - **Input**: `{session_id, modifications: [...]}`.
    - **Action**: Generate PDF from current images in `.tmp/`.
    - **Output**: JSON `{download_url}`.
6.  **`GET /download/{filename}`**:
    - Serve generated PDF.
7.  **`POST /restore-page`** (Full Restore):
    - **Input**: `{session_id, page_index}`.
    - **Action**: Revert to original.

## Static Files
- Serve `static/` directory for CSS/JS.
- Serve `.tmp/` (carefully) for page images previews.

## Error Handling
- Return standard HTTP error codes (400 for bad input, 500 for script failure).
