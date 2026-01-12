# PDF Text Editor (NotebookLM 簡報編輯器)

這是一個專為 NotebookLM 生成的 PDF 簡報設計的文字編輯工具。它允許使用者上傳 PDF，自動進行 OCR 辨識，並提供網頁介面修正文字內容、樣式（粗體、斜體、顏色、字體），最後重新生成修正後的 PDF。

## 功能特色 (Features)
- **PDF 轉圖片與 OCR**: 自動將 PDF 轉換為高解析度圖片並辨識文字區域。
- **網頁編輯介面**:
    - **文字修改**: 直接點擊區塊修改文字。
    - **樣式調整**: 支援粗體 (Bold)、斜體 (Italic)、字體大小 (Auto/Custom)、字體顏色 (Color Picker)。
    - **多字體支援**: 內建 Noto Sans TC, Roboto, Open Sans 等多種字體。
    - **即時預覽**: 編輯後自動去除原文字 (Inpainting) 並繪製新樣式。
    - **Undo 機制**: 支援單一區塊的快速還原。
- **PDF 生成**: 將所有修改後的頁面重新打包為 PDF 下載。
- **RTX 5090 支援**: 針對 NVIDIA Blackwell 架構優化 PyTorch 設定。

## 安裝教學 (Installation)

### 1. 環境需求
- Windows 10/11 (推薦)
- Python 3.10 ~ 3.12 (Python 3.13 須注意 pillow 版本相容性)
- NVIDIA GPU (建議，需安裝 CUDA 12.x)

### 2. 下載專案
確保您已將專案下載至本地目錄。

### 3. 安裝相依套件
請使用 `pip` 安裝 `requirements.txt` 中列出的套件：

```bash
pip install -r requirements.txt
```

> **注意**: 若您使用 Python 3.13，請確保 `pillow` 版本大於等於 10.4.0。

## 執行伺服器 (Running the Server)

本專案使用 FastAPI 開發，請使用 ASGI Runner 啟動伺服器。

### 方法一：使用 FastAPI CLI (推薦)
```bash
fastapi run server.py
```

### 方法二：使用 Uvicorn
```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```
*(若需開發除錯，可加上 `--reload` 參數)*

伺服器啟動後，請打開瀏覽器訪問：
**http://localhost:8000**

## 使用說明 (Usage)
1.  **上傳**: 拖曳 PDF 檔案至上傳區域。
2.  **分析**: 點擊頁面下方的「開始分析」按鈕進行 OCR。
3.  **編輯**:
    - 點擊畫面上的藍色文字框。
    - 在右側面板修改文字、選擇字體、顏色、大小或粗體/斜體。
    - 按下 **Apply** 套用修改 (圖片會即時更新)。
    - 若需取消，按下 **Undo** 還原。
4.  **下載**: 確認所有修改完成後，切換至右側「匯出文件」面板，點擊 **Download** 下載最終 PDF。

## 目錄結構
- `server.py`: 後端主程式。
- `execution/`: 核心邏輯 (OCR, 繪圖, PDF 處理)。
- `static/`: 前端資源 (JS, CSS, Fonts)。
- `templates/`: HTML 模板。
- `logs/`: 伺服器日誌 (依日期命名，例如 `server-20260112.log`)。
