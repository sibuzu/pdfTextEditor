# Directive: Analyze Page (OCR)

## Goal
Perform OCR on a single page image to detect text blocks and their bounding boxes.

## Inputs
- `image_path`: Absolute path to the page image.
- `ocr_engine`: (Optional) Identifier for the OCR engine to use (e.g., 'mock', 'easyocr', 'ollama').

## Tools/Scripts
- `execution/ocr_engine.py` (to be created)
    - Function: `analyze_image(image_path, engine='mock')`

## Steps
1.  **Load Image**: Open the image file.
2.  **Preprocess**: (Optional) Apply contrast/grayscale if needed for better OCR.
3.  **Execute OCR**:
    - **Mock Mode**: Return dummy text blocks for testing UI.
    - **Real Mode**: Call the OCR library/API.
4.  **Format Output**:
    - Return a list of "Regions" or "Blocks".
    - Each block must have:
        - `id`: Unique identifier (e.g., index).
        - `text`: The detected text content.
        - `bbox`: Coordinates `[x, y, width, height]` or `[x1, y1, x2, y2]`. **Define standard**: Use normalized codes (0.0-1.0) or pixel values. (Pixel values preferred for canvas).
        - `confidence`: (0-100%).
5.  **Return Data**: JSON serializable list.

## Notes
- **Llava/Ollama**: If using a VLM, ensure the prompt asks for "JSON output with bounding boxes".
- **EasyOCR**: Returns `(bbox, text, prob)`.
