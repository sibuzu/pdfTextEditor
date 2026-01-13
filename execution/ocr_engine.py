import threading
import logging

logger = logging.getLogger(__name__)

from typing import List, Dict, Any, Union

# Global instance to avoid reloading model
_ocr_engine = None
_ocr_lock = threading.Lock()

def get_ocr_engine(lang='ch'):
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            # Initialize PaddleOCR
            # Disable angle classification to avoid potential unwarping/pre-processing shifts
            print("Initializing PaddleOCR...")
            # Disable advanced doc handling to ensure coordinates match the original image
            _ocr_engine = PaddleOCR(
                use_angle_cls=False, 
                lang=lang, 
                use_doc_orientation_classify=False,
                use_doc_unwarping=False
            )

        except ImportError:
            print("PaddleOCR not installed. Please run: pip install paddlepaddle paddleocr")
            raise ImportError("PaddleOCR not found")
    return _ocr_engine


def analyze_image(image_path: str, engine='paddle') -> List[Dict[str, Any]]:
    # ...
    if engine == 'mock':
        return _mock_analysis(image_path)
        
    try:
        ocr = get_ocr_engine()
        # Lock to ensure thread safety
        with _ocr_lock:
            result = ocr.ocr(image_path)
            
        logger.info(f"DEBUG: OCR Result type: {type(result)}")
        # Log summary instead of full result to avoid huge logs
        # logger.info(f"DEBUG: OCR Result summary: {str(result)[:500]}")
        return _parse_paddle_result(result)
    except ImportError:
        logger.warning("Fallback to mock because PaddleOCR is missing.")
        return _mock_analysis(image_path)
    except Exception as e:
        logger.error(f"Error in OCR: {e}")
        return []

def _parse_paddle_result(result) -> List[Dict[str, Any]]:
    """
    Parse PaddleOCR result into standard format.
    """
    blocks = []
    if not result:
        return blocks
        
    # Check for new format (List of Dicts with keys like 'rec_texts', 'dt_polys')
    if isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict):
        data = result[0]
        texts = data.get('rec_texts', [])
        scores = data.get('rec_scores', [])
        boxes = data.get('dt_polys', []) 
        
        for i, (text, score, box) in enumerate(zip(texts, scores, boxes)):
            if not text or not text.strip():
                continue
                
            # box is likely numpy array of shape (4, 2)
            if hasattr(box, 'tolist'):
                box = box.tolist()
            
            # Calculate bbox [x, y, w, h] from 4 points
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            x_min = min(xs)
            y_min = min(ys)
            w = max(xs) - x_min
            h = max(ys) - y_min
            
            blocks.append({
                "id": i,
                "text": text,
                "bbox": [int(x_min), int(y_min), int(w), int(h)],
                "confidence": round(float(score), 4)
            })
        return blocks
    
    # Fallback/Older format handling...
    lines = result
    if len(result) > 0 and isinstance(result[0], list) and len(result[0]) > 0 and isinstance(result[0][0], list) and len(result[0][0]) == 4:
         pass
    elif len(result) > 0 and isinstance(result[0], list):
         lines = result[0]

    if not lines:
        return blocks

    for i, line in enumerate(lines):
        if not isinstance(line, list) or len(line) < 2:
            continue
            
        box_points = line[0] 
        text_info = line[1]
        text = text_info[0]
        confidence = text_info[1]
        
        if not text or not text.strip():
            continue

        xs = [p[0] for p in box_points]
        ys = [p[1] for p in box_points]
        x_min = min(xs)
        y_min = min(ys)
        w = max(xs) - x_min
        h = max(ys) - y_min
        
        blocks.append({
            "id": i,
            "text": text,
            "bbox": [int(x_min), int(y_min), int(w), int(h)],
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
