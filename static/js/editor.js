document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    const loading = document.getElementById('loading');
    const editorContainer = document.getElementById('editorContainer');
    const pagesContainer = document.getElementById('pagesContainer');
    const selectedEdit = document.getElementById('selectedEdit');
    const selectedInput = document.getElementById('selectedInput');
    const applyEditBtn = document.getElementById('applyEditBtn');
    const undoEditBtn = document.getElementById('undoEditBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentSessionId = null;
    let currentPages = []; // Paths to images
    let pageData = {}; // Key: pageIndex, Value: { blocks: [], analyzed: false, modifications: Map }
    let currentSelection = null; // { pageIndex, blockId }
    let hasModifications = false;
    let boxesVisible = true;

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
                hasModifications = false; // Reset flag
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

            pageData[index] = { blocks: [], analyzed: false, modifications: new Map() };
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

                // Update Count
                document.getElementById('regionCount').textContent = `[Page ${pageIndex + 1}] ${data.blocks.length} 個文字區域`;
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
            if (img.naturalWidth === 0) return;

            const rect = img.getBoundingClientRect();
            const renderedWidth = img.offsetWidth;
            const renderedHeight = img.offsetHeight;
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;

            const scaleX = renderedWidth / naturalWidth;
            const scaleY = renderedHeight / naturalHeight;

            container.innerHTML = '';
            container.style.position = 'absolute';
            container.style.top = img.offsetTop + 'px';
            container.style.left = img.offsetLeft + 'px';
            container.style.width = renderedWidth + 'px';
            container.style.height = renderedHeight + 'px';
            container.style.pointerEvents = 'none';
            container.style.display = boxesVisible ? 'block' : 'none';

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
        document.getElementById('selectedPage').style.display = 'none';

        // Load State (Existing Mod or Default)
        const mod = pageData[pageIndex].modifications.get(blockId);

        selectedInput.value = mod ? mod.text : block.text;
        document.getElementById('fontFamilySelect').value = mod ? mod.font_family : 'NotoSansTC';
        document.getElementById('fontSizeInput').value = mod ? mod.font_size : '';
        document.getElementById('boldCheckbox').checked = mod ? mod.is_bold : false;
        document.getElementById('italicCheckbox').checked = mod ? mod.is_italic : false;

        selectedInput.focus();

        // Update active page info
        const count = pageData[pageIndex].blocks.length;
        document.getElementById('regionCount').textContent = `[Page ${pageIndex + 1}] ${count} 個文字區域`;

        updateUndoButtonState(!!mod);
    }

    function updateUndoButtonState(isModified) {
        if (!undoEditBtn) return;
        undoEditBtn.disabled = !isModified;
        if (isModified) {
            undoEditBtn.classList.remove('btn-secondary');
            undoEditBtn.classList.add('btn-primary');
        } else {
            undoEditBtn.classList.remove('btn-primary');
            undoEditBtn.classList.add('btn-secondary');
        }
    }

    // Undo (Revert) Edit
    if (undoEditBtn) {
        undoEditBtn.addEventListener('click', async () => {
            if (!currentSelection) return;
            const { pageIndex, blockId } = currentSelection;

            if (pageData[pageIndex].modifications.has(blockId)) {
                // Remove Modification directly (No Confirm)
                pageData[pageIndex].modifications.delete(blockId);
                await callUpdatePage(pageIndex);

                // Keep input values (DO NOT reset)
                // Just update button state
                updateUndoButtonState(false);
                hasModifications = checkModifications();
            } else {
                // Not modified, do nothing
            }
        });
    }

    applyEditBtn.addEventListener('click', async () => {
        if (!currentSelection) return;

        const { pageIndex, blockId } = currentSelection;
        const block = pageData[pageIndex].blocks.find(b => b.id === blockId);

        // Gather Values
        const text = selectedInput.value;
        const fontFamily = document.getElementById('fontFamilySelect').value;
        const fontSizeVal = document.getElementById('fontSizeInput').value;
        const fontSize = fontSizeVal ? parseInt(fontSizeVal) : null;
        const isBold = document.getElementById('boldCheckbox').checked;
        const isItalic = document.getElementById('italicCheckbox').checked;

        // Save State
        pageData[pageIndex].modifications.set(blockId, {
            bbox: block.bbox,
            text: text,
            font_family: fontFamily,
            font_size: fontSize,
            is_bold: isBold,
            is_italic: isItalic
        });

        // Visual Feedback
        const originalText = applyEditBtn.textContent;
        applyEditBtn.textContent = 'Applying...';
        applyEditBtn.disabled = true;

        await callUpdatePage(pageIndex);

        applyEditBtn.textContent = originalText;
        applyEditBtn.disabled = false;
        hasModifications = true;
        updateUndoButtonState(true);
    });

    async function callUpdatePage(pageIndex) {
        // Collect edits from Map
        const edits = [];
        pageData[pageIndex].modifications.forEach((mod, id) => {
            edits.push(mod); // mod already contains bbox, text, styles
        });

        try {
            const resp = await fetch('/update-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    page_index: pageIndex,
                    edits: edits
                })
            });
            const data = await resp.json();

            if (resp.ok) {
                // Refresh Image with timestamp
                const img = document.getElementById(`pageImg-${pageIndex}`);
                img.src = `${data.image_url}?t=${new Date().getTime()}`;

                window.renderRestoreBtn(pageIndex);
            } else {
                alert('Update failed: ' + data.detail);
            }
        } catch (e) {
            console.error(e);
            alert('Error updating page');
        }
    }

    // Check if any modifications exist across all pages
    function checkModifications() {
        for (const pIdx in pageData) {
            if (pageData[pIdx].modifications.size > 0) return true;
        }
        return false;
    }

    // Function to render Restore Button (Old full page restore)
    window.renderRestoreBtn = function (pageIndex) {
        if (document.getElementById(`restoreBtn-${pageIndex}`)) return;

        const header = document.querySelector(`#pageWrapper-${pageIndex}`).previousElementSibling;
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
            // Also clear frontend state
            pageData[pageIndex].modifications.clear();
            hasModifications = checkModifications();

            // Just use the new architecture: empty edits list = restore original
            await callUpdatePage(pageIndex);

            // Also reset current selection UI if it belongs to this page
            if (currentSelection && currentSelection.pageIndex === pageIndex) {
                const block = pageData[pageIndex].blocks.find(b => b.id === currentSelection.blockId);
                if (block) {
                    // Reset to original values since FULL RESTORE implies starting over
                    selectedInput.value = block.text;
                    document.getElementById('fontFamilySelect').value = 'NotoSansTC';
                    document.getElementById('fontSizeInput').value = '';
                    document.getElementById('boldCheckbox').checked = false;
                    document.getElementById('italicCheckbox').checked = false;
                    updateUndoButtonState(false);
                }
            }

        } catch (e) {
            console.error(e);
            alert('Error restoring page');
        }
    }

    downloadBtn.addEventListener('click', async () => {
        hasModifications = checkModifications();
        if (!hasModifications) {
            alert('沒有任何修改，無需下載。\n(No modifications made.)');
            return;
        }

        downloadBtn.textContent = 'Generating...';
        downloadBtn.disabled = true;

        const modifications = [];
        Object.keys(pageData).forEach(pIdx => {
            pageData[pIdx].modifications.forEach((mod, id) => {
                modifications.push({
                    page_index: parseInt(pIdx),
                    bbox: mod.bbox,
                    text: mod.text,
                    font_family: mod.font_family,
                    font_size: mod.font_size,
                    is_bold: mod.is_bold,
                    is_italic: mod.is_italic
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
                const a = document.createElement('a');
                a.href = url;
                a.download = 'edited.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => alert('下載完成 (Download Complete)'), 100);
            } else {
                alert('Generation failed: ' + (data.detail || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Error generating PDF: ' + e.message);
        } finally {
            downloadBtn.textContent = '下載 (Download)';
            downloadBtn.disabled = false;
        }
    });


    // Toggle Box Visibility
    document.getElementById('toggleBoxesBtn').addEventListener('click', () => {
        boxesVisible = !boxesVisible;
        const svg = document.querySelector('#toggleBoxesBtn svg');
        if (boxesVisible) {
            svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        } else {
            svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>';
        }
        Object.keys(pageData).forEach(pIdx => {
            const c = document.getElementById(`bboxContainer-${pIdx}`);
            if (c) c.style.display = boxesVisible ? 'block' : 'none';
        });
    });

});
