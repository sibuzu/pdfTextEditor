import os
import uuid
import shutil
import uvicorn

from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import execution modules
from execution import process_pdf, ocr_engine, generate_pdf, editor_engine

import logging

# ... dependencies ... 

# Configure Logging
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "server.log")

# Setup Root Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ],
    force=True
)
logger = logging.getLogger(__name__)

# Configure Uvicorn Loggers to propagate to Root
# and remove their default handlers to prevent duplication
for log_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
    log = logging.getLogger(log_name)
    log.handlers = []
    log.propagate = True

logger.info("Server is starting up... Logging configured.")





app = FastAPI(title="PDFTextEdit")


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
TMP_DIR = ".tmp"
STATIC_DIR = "static"
os.makedirs(TMP_DIR, exist_ok=True)

# Mount Static
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def read_root():
    return FileResponse("templates/index.html")

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF is supported.")
    
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    pdf_path = os.path.join(session_dir, "input.pdf")
    
    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Call execution.process_pdf.convert_pdf_to_images
        images = process_pdf.convert_pdf_to_images(pdf_path, session_dir)
        
        return {
            "session_id": session_id,
            "pages": images,
            "message": "Upload successful"
        }
    except Exception as e:
        logger.error(f"Error in upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AnalyzeRequest(BaseModel):
    session_id: str
    page_index: int

@app.post("/analyze")
async def analyze_page(request: AnalyzeRequest):
    session_dir = os.path.join(TMP_DIR, request.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Call execution.ocr_engine.analyze_image
    # We need to reconstruct the image filename. 
    # Assumption: process_pdf returns 'page_N.png' where N is index?
    # process_pdf logic: f"page_{i}.png", i starts at 0.
    image_path = os.path.join(session_dir, f"page_{request.page_index}.png")
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail=f"Image for page {request.page_index} not found")

    blocks = ocr_engine.analyze_image(image_path)
    
    return {"blocks": blocks}

class TextModification(BaseModel):
    bbox: List[float] # [x, y, w, h]
    text: str
    page_index: int
    # format options...

class GenerateRequest(BaseModel):
    session_id: str
    modifications: List[TextModification]

@app.post("/generate")
async def generate_pdf_endpoint(request: GenerateRequest):
    session_dir = os.path.join(TMP_DIR, request.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Call execution.generate_pdf.create_pdf
    output_path = generate_pdf.create_pdf(session_dir, request.modifications)
    
    # generate_pdf returns filename, logical path is in session_dir
    
    return {"download_url": f"/download/{request.session_id}/{output_path}"}

class EditSpec(BaseModel):
    bbox: List[float] # [x, y, w, h]
    text: str 
    is_italic: bool = False
    is_bold: bool = False
    font_family: str = "NotoSansTC"
    font_size: Optional[int] = None

class UpdatePageRequest(BaseModel):
    session_id: str
    page_index: int
    edits: List[EditSpec]

@app.post("/update-page")
async def update_page(request: UpdatePageRequest):
    try:
        session_dir = os.path.join(TMP_DIR, request.session_id)
        if not os.path.exists(session_dir):
            raise HTTPException(status_code=404, detail="Session not found")
            
        image_path = os.path.join(session_dir, f"page_{request.page_index}.png")
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Page image not found")

        # 1. Restore Original
        editor_engine.restore_page(image_path)
        
        # 2. Apply All Edits
        for edit in request.edits:
            editor_engine.apply_edit(
                image_path, 
                edit.bbox, 
                edit.text, 
                font_family=edit.font_family,
                font_size=edit.font_size,
                is_bold=edit.is_bold,
                is_italic=edit.is_italic,
                restore_first=False
            )
        
        return {"status": "success", "image_url": f"/tmp/{request.session_id}/page_{request.page_index}.png"}
    except Exception as e:
        logger.error(f"Error updating page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ApplyEditRequest(BaseModel):
    session_id: str
    page_index: int
    bbox: List[float] # [x, y, w, h]
    text: str 
    is_italic: bool = False # New field

@app.post("/apply-edit")
async def apply_edit(request: ApplyEditRequest):
    session_dir = os.path.join(TMP_DIR, request.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session not found")
        
    image_path = os.path.join(session_dir, f"page_{request.page_index}.png")
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Page image not found")

    try:
        # Step 1 & 2: Inpaint and Render Text
        editor_engine.apply_edit(image_path, request.bbox, request.text, is_italic=request.is_italic)
        
        return {"status": "success", "image_url": f"/tmp/{request.session_id}/page_{request.page_index}.png"}
    except Exception as e:
        logger.error(f"Error applying edit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RestoreRequest(BaseModel):
    session_id: str
    page_index: int

@app.post("/restore-page")
async def restore_page(request: RestoreRequest):
    session_dir = os.path.join(TMP_DIR, request.session_id)
    image_path = os.path.join(session_dir, f"page_{request.page_index}.png")
    
    try:
        editor_engine.restore_page(image_path)
        return {"status": "success", "image_url": f"/tmp/{request.session_id}/page_{request.page_index}.png"}
    except Exception as e:
        logger.error(f"Error restoring page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{session_id}/{filename}")
async def download_file(session_id: str, filename: str):
    file_path = os.path.join(TMP_DIR, session_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename)

# Mount TMP for previewing images (careful in prod, ok for local tool)
app.mount("/tmp", StaticFiles(directory=TMP_DIR), name="tmp")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_config=None)
