document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    const loading = document.getElementById('loading');
    const editorContainer = document.getElementById('editorContainer');
    const pagesContainer = document.getElementById('pagesContainer');
    const selectedEdit = document.getElementById('selectedEdit');
    const selectedInput = document.getElementById('selectedInput');
    const applyEditBtn = document.getElementById('applyEditBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentSessionId = null;
    let currentPages = []; // Paths to images
    let pageData = {}; // Key: pageIndex, Value: { blocks: [], analyzed: false }
    let currentSelection = null; // { pageIndex, blockId }

    // Upload Handler
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => e.preventDefault());
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        handleUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => handleUpload(e.target.files[0]));

    async function handleUpload(file) {
        if (!file) return;

        uploadZone.style.display = 'none';
        loading.style.display = 'block';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const resp = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();

            if (resp.ok) {
                currentSessionId = data.session_id;
                currentPages = data.pages;
                initEditor();
            } else {
                alert('Upload failed: ' + data.detail);
                uploadZone.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            alert('Upload error');
            uploadZone.style.display = 'block';
        } finally {
            loading.style.display = 'none';
        }
    }

    function initEditor() {
        editorContainer.style.display = 'flex';
        pagesContainer.innerHTML = '';

        currentPages.forEach((pagePath, index) => {
            // Check if full URL or relative
            // pagePath from backend is just filename "page_0.png"
            const imageUrl = `/tmp/${currentSessionId}/${pagePath}`;

            const pageCard = document.createElement('div');
            pageCard.className = 'page-card';
            pageCard.innerHTML = `
                <div class="page-header">Page ${index + 1}</div>
                <div class="page-image-wrapper" id="pageWrapper-${index}">
                    <img src="${imageUrl}" class="page-image" id="pageImg-${index}">
                    <div class="analyze-btn-container" id="analyzeBtnContainer-${index}">
                        <button class="btn-analyze" onclick="analyzePage(${index})">此頁尚未分析 (開始分析)</button>
                    </div>
                    <div id="bboxContainer-${index}"></div>
                </div>
            `;
            pagesContainer.appendChild(pageCard);

            pageData[index] = { blocks: [], analyzed: false };
        });
    }

    window.analyzePage = async function (pageIndex) {
        const btnContainer = document.getElementById(`analyzeBtnContainer-${pageIndex}`);
        const btn = btnContainer.querySelector('button');
        btn.textContent = "分析中...";
        btn.disabled = true;

        try {
            const resp = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId, page_index: pageIndex })
            });
            const data = await resp.json();

            if (resp.ok) {
                pageData[pageIndex].blocks = data.blocks;
                pageData[pageIndex].analyzed = true;
                btnContainer.style.display = 'none';
                renderBBoxes(pageIndex);
            } else {
                alert('Analysis failed');
                btn.textContent = "重試分析";
                btn.disabled = false;
            }
        } catch (e) {
            console.error(e);
            alert('Error analyzing page');
            btn.textContent = "重試分析";
            btn.disabled = false;
        }
    };

    function renderBBoxes(pageIndex) {
        const container = document.getElementById(`bboxContainer-${pageIndex}`);
        const blocks = pageData[pageIndex].blocks;
        const img = document.getElementById(`pageImg-${pageIndex}`);

        // Ensure image is loaded to get dimensions (conceptually, but absolute positioning relies on wrapper)
        // Note: Backend returns pixels. We just overlay if image size matches.
        // Or we might need to map scaling if CSS resizes image?
        // For simplicity, let's assume image is displayed at natural width or we use percentages.
        // If Backend returns pixels, and CSS scales image to 100% width, we need to map.
        // Let's assume for prototype we rely on visual matching or 1:1.
        // BETTER: Use percentages if possible. But Mock Engine returned Pixels. 
        // We will assume 1:1 mapping for the Mock.

        container.innerHTML = '';

        blocks.forEach(block => {
            const div = document.createElement('div');
            div.className = 'bbox';
            div.style.left = block.bbox[0] + 'px';
            div.style.top = block.bbox[1] + 'px';
            div.style.width = block.bbox[2] + 'px';
            div.style.height = block.bbox[3] + 'px';
            div.dataset.id = block.id;

            div.addEventListener('click', (e) => {
                e.stopPropagation();
                selectBlock(pageIndex, block.id, div);
            });

            container.appendChild(div);
        });
    }

    function selectBlock(pageIndex, blockId, element) {
        // Deselect previous
        document.querySelectorAll('.bbox.selected').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');

        currentSelection = { pageIndex, blockId };
        const block = pageData[pageIndex].blocks.find(b => b.id === blockId);

        selectedEdit.style.display = 'block';
        document.getElementById('selectedId').textContent = `#${blockId}`;
        document.getElementById('selectedPage').textContent = `Page ${pageIndex + 1}`;
        selectedInput.value = block.text;
        selectedInput.focus();
    }

    applyEditBtn.addEventListener('click', () => {
        if (!currentSelection) return;

        const { pageIndex, blockId } = currentSelection;
        const block = pageData[pageIndex].blocks.find(b => b.id === blockId);

        const newText = selectedInput.value;
        block.text = newText;

        alert('修改已暫存 (前端)');
        // Visual feedback? maybe change bbox color?

        // Enable download if modifications
        downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', async () => {
        downloadBtn.textContent = 'Generating...';
        downloadBtn.disabled = true;

        // Gather modifications
        const modifications = [];
        Object.keys(pageData).forEach(pIdx => {
            pageData[pIdx].blocks.forEach(block => {
                // In real app, we check if modified. For now send all or just assume we send everything for reconstruction.
                // Sending everything allow regenerate PDF completely.
                modifications.push({
                    page_index: parseInt(pIdx),
                    bbox: block.bbox,
                    text: block.text
                });
            });
        });

        try {
            const resp = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    modifications: modifications
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                const url = data.download_url;
                // Trigger download
                const a = document.createElement('a');
                a.href = url;
                a.download = 'edited.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                alert('Generation failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error generating PDF');
        } finally {
            downloadBtn.textContent = '下載';
            downloadBtn.disabled = false;
        }
    });

});
