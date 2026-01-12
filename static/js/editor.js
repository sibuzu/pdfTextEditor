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
    let hasModifications = false;

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

        if (!img) return;

        function doRender() {
            if (img.naturalWidth === 0) {
                // If loaded but 0 width, something is wrong, or SVG?
                return;
            }

            const rect = img.getBoundingClientRect();
            // Use rect for rendered dimensions to account for sizing
            const renderedWidth = img.offsetWidth;
            const renderedHeight = img.offsetHeight;
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;

            const scaleX = renderedWidth / naturalWidth;
            const scaleY = renderedHeight / naturalHeight;

            console.log(`[Page ${pageIndex}] Scaling BBoxes: Rendered ${renderedWidth}x${renderedHeight}, Natural ${naturalWidth}x${naturalHeight}, Scale ${scaleX}, ${scaleY}`);

            container.innerHTML = '';
            container.style.position = 'absolute';
            // Explicitly align container to image position
            container.style.top = img.offsetTop + 'px';
            container.style.left = img.offsetLeft + 'px';
            container.style.width = renderedWidth + 'px';
            container.style.height = renderedHeight + 'px';
            container.style.pointerEvents = 'none';

            blocks.forEach(block => {
                const div = document.createElement('div');
                div.className = 'bbox';

                div.style.left = (block.bbox[0] * scaleX) + 'px';
                div.style.top = (block.bbox[1] * scaleY) + 'px';
                div.style.width = (block.bbox[2] * scaleX) + 'px';
                div.style.height = (block.bbox[3] * scaleY) + 'px';

                div.style.pointerEvents = 'auto';
                div.dataset.id = block.id;
                div.title = block.text;

                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectBlock(pageIndex, block.id, div);
                });

                container.appendChild(div);
            });
        }

        if (img.complete && img.naturalWidth > 0) {
            doRender();
        } else {
            img.onload = doRender;
        }

        window.removeEventListener('resize', img._resizeHandler);
        img._resizeHandler = doRender;
        window.addEventListener('resize', img._resizeHandler);
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

    applyEditBtn.addEventListener('click', async () => {
        if (!currentSelection) return;

        const { pageIndex, blockId } = currentSelection;
        const block = pageData[pageIndex].blocks.find(b => b.id === blockId);

        const newText = selectedInput.value;
        const isItalic = document.getElementById('italicCheckbox').checked;
        block.text = newText;

        // Visual Feedback: Call inpainting
        applyEditBtn.textContent = 'Applying...';
        applyEditBtn.disabled = true;

        try {
            const resp = await fetch('/apply-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    page_index: pageIndex,
                    bbox: block.bbox,
                    text: newText,
                    is_italic: isItalic
                })
            });
            const data = await resp.json();

            if (resp.ok) {
                // Refresh Image with timestamp to bust cache
                const img = document.getElementById(`pageImg-${pageIndex}`);
                img.src = `${data.image_url}?t=${new Date().getTime()}`;

                window.renderRestoreBtn(pageIndex);

                // Update modification flag
                hasModifications = true;
            } else {
                alert('Apply failed: ' + data.detail);
            }
        } catch (e) {
            console.error(e);
            alert('Error applying edit');
        } finally {
            applyEditBtn.textContent = '套用修改';
            applyEditBtn.disabled = false;
        }
    });

    // Function to render Restore Button
    window.renderRestoreBtn = function (pageIndex) {
        // Check if exists
        if (document.getElementById(`restoreBtn-${pageIndex}`)) return;

        const container = document.getElementById(`analyzeBtnContainer-${pageIndex}`);
        // If analyze button is gone, we can put it there or alongside header?
        // Let's put it in the page header for now

        const header = document.querySelector(`#pageWrapper-${pageIndex}`).previousElementSibling;
        // simplistic selector, relies on initEditor structure

        const btn = document.createElement('button');
        btn.id = `restoreBtn-${pageIndex}`;
        btn.className = 'btn-secondary';
        btn.style.marginLeft = '10px';
        btn.style.fontSize = '0.8rem';
        btn.style.padding = '0.2rem 0.5rem';
        btn.textContent = "全部回復 (Restore)";
        btn.onclick = () => restorePage(pageIndex);

        header.appendChild(btn);
    }

    async function restorePage(pageIndex) {
        if (!confirm('確定要回復此頁面嗎？所有修改將消失。')) return;

        try {
            const resp = await fetch('/restore-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    page_index: pageIndex
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                const img = document.getElementById(`pageImg-${pageIndex}`);
                img.src = `${data.image_url}?t=${new Date().getTime()}`;
            } else {
                alert('Restore failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error restoring page');
        }
    }

    downloadBtn.addEventListener('click', async () => {
        if (!hasModifications) {
            alert('沒有任何修改，無需下載。\n(No modifications made.)');
            return;
        }

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
