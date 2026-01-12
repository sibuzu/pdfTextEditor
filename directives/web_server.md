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
    - **Action**:
        - Save file to `.tmp/`.
        - Call `execution/process_pdf.py` -> `convert_pdf_to_images`.
        - Generate unique session ID.
    - **Output**: JSON `{session_id, pages: [image_urls]}`.
3.  **`POST /analyze`**:
    - **Input**: `{session_id, page_index}`.
    - **Action**:
        - Locate image for session/page.
        - Call `execution/ocr_engine.py` -> `analyze_image`.
    - **Output**: JSON `{blocks: [...]}`.
4.  **`POST /generate`**:
    - **Input**: `{session_id, modifications: [...]}`.
    - **Action**:
        - Call `execution/generate_pdf.py`.
    - **Output**: JSON `{download_url}`.
5.  **`GET /download/{filename}`**:
    - Serve the generated PDF.

## Static Files
- Serve `static/` directory for CSS/JS.
- Serve `.tmp/` (carefully) for page images previews.

## Error Handling
- Return standard HTTP error codes (400 for bad input, 500 for script failure).
