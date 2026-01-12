from typing import List, Dict, Any, Union

# Global instance to avoid reloading model
_ocr_engine = None

def get_ocr_engine(lang='ch'):
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            # Initialize PaddleOCR
            # use_angle_cls=True allows detecting text at angles
            # lang='ch' supports Chinese and English
            print("Initializing PaddleOCR...")
            _ocr_engine = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        except ImportError:
            print("PaddleOCR not installed. Please run: pip install paddlepaddle paddleocr")
            raise ImportError("PaddleOCR not found")
    return _ocr_engine

def analyze_image(image_path: str, engine='paddle') -> List[Dict[str, Any]]:
    """
    Analyze an image to extract text blocks using PaddleOCR.
    
    Args:
        image_path: Path to the image file.
        engine: 'paddle' (default) or 'mock'
        
    Returns:
        List of dicts: {id, text, bbox, confidence}
    """
    if engine == 'mock':
        return _mock_analysis(image_path)
        
    try:
        ocr = get_ocr_engine()
        result = ocr.ocr(image_path, cls=True)
        return _parse_paddle_result(result)
    except ImportError:
        print("Fallback to mock because PaddleOCR is missing.")
        return _mock_analysis(image_path)
    except Exception as e:
        print(f"Error in OCR: {e}")
        return []

def _parse_paddle_result(result) -> List[Dict[str, Any]]:
    """
    Parse PaddleOCR result into standard format.
    Paddle Result Structure: 
    [
      [
        [[x1, y1], [x2, y2], [x3, y3], [x4, y4]], # Box points
        (text, confidence)
      ],
      ...
    ]
    Result might be a list of lists if multiple images (but we send one).
    PaddleOCR returns [ [[box], (text, conf)], ... ] for single image path.
    Sometimes result is None if no text found.
    Sometimes result is [None] or similar.
    """
    blocks = []
    if not result or result[0] is None:
        return blocks
        
    # Valid result for one image is usually result[0] if input is list, 
    # but ocr(image_path) usually returns list of lines.
    # Actually, paddleocr.ocr returns a list of results (one per image passed).
    # Since we passed one image path, result[0] is the data for that image.
    
    data = result[0] 
    
    for i, line in enumerate(data):
        # line = [box_points, (text, score)]
        box_points = line[0] # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        text_info = line[1]
        text = text_info[0]
        confidence = text_info[1]
        
        # Calculate BBox [x, y, w, h]
        # Assuming axis aligned for simplicity, or just taking min/max
        xs = [p[0] for p in box_points]
        ys = [p[1] for p in box_points]
        x_min = min(xs)
        y_min = min(ys)
        x_max = max(xs)
        y_max = max(ys)
        w = x_max - x_min
        h = y_max - y_min
        
        blocks.append({
            "id": i,
            "text": text,
            "bbox": [x_min, y_min, w, h],
            "confidence": round(confidence, 4)
        })
        
    return blocks

def _mock_analysis(image_path):
    print(f"Mock analyzing: {image_path}")
    blocks = []
    for i in range(5):
        blocks.append({
            "id": i,
            "text": f"Mock Text Block {i}",
            "bbox": [100, 100 + (i * 60), 300, 50],
            "confidence": 0.95
        })
    return blocks
