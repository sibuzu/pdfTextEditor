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
    let currentPages = [];
    let pageData = {};
    let currentSelection = null;
    let activePageIndex = null;

    // Add Listener for Remove Text Checkbox
    const removeTextCheckbox = document.getElementById('removeTextCheckbox');
    if (removeTextCheckbox) {
        removeTextCheckbox.addEventListener('change', () => {
            selectedInput.disabled = removeTextCheckbox.checked;
            // Behavior: 
            // 1. Disable textbox
            // 2. Do NOT clear it (preserve value for uncheck restore)
        });
    }

    const ICONS = {
        restore: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        eye: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>`,
        magnifier: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`
    };

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
            const resp = await fetch('/upload', { method: 'POST', body: formData });
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
            const imageUrl = `/tmp/${currentSessionId}/${pagePath}`;

            pageData[index] = {
                blocks: [],
                analyzed: false,
                modifications: new Map(),
                visible: true,
                magnifier: false
            };

            const pageCard = document.createElement('div');
            pageCard.className = 'page-card';
            pageCard.id = `pageCard-${index}`;
            pageCard.innerHTML = `
                <div class="page-header">
                    <span>Page ${index + 1}</span>
                    <span class="page-toolbar" id="toolbar-${index}" style="visibility: hidden; margin-left: 20px;">
                        <button class="btn-toolbar" id="restoreBtn-${index}" title="全部回復 (Restore)" disabled>
                            ${ICONS.restore} <span style="margin-left:4px;font-size:0.75rem;">全部回復</span>
                        </button>
                        <button class="btn-toolbar" id="visBtn-${index}" title="顯示/隱藏文字框">
                            ${ICONS.eye}
                        </button>
                        <button class="btn-toolbar" id="magBtn-${index}" title="放大鏡 (Magnifier)">
                            ${ICONS.magnifier}
                        </button>
                    </span>
                </div>
                <div class="page-image-wrapper" id="pageWrapper-${index}">
                    <div class="magnifier-lens" id="lens-${index}"></div>
                    <img src="${imageUrl}" class="page-image" id="pageImg-${index}">
                    <div class="analyze-btn-container" id="analyzeBtnContainer-${index}">
                        <button class="btn-analyze" onclick="analyzePage(${index})">此頁尚未分析 (開始分析)</button>
                    </div>
                    <div id="bboxContainer-${index}"></div>
                </div>
            `;
            pagesContainer.appendChild(pageCard);

            document.getElementById(`restoreBtn-${index}`).onclick = () => restorePage(index);
            document.getElementById(`visBtn-${index}`).onclick = () => toggleVisibility(index);
            document.getElementById(`magBtn-${index}`).onclick = () => toggleMagnifier(index);

            const img = document.getElementById(`pageImg-${index}`);
            img.addEventListener('click', () => setActivePage(index));
        });

        const globalToggle = document.getElementById('toggleBoxesBtn');
        if (globalToggle) globalToggle.style.display = 'none';

        // Disable Controls initially
        setEditPanelEnabled(false);
    }

    // Helper: Enable/Disable Edit Panel
    function setEditPanelEnabled(enabled) {
        selectedInput.disabled = !enabled;
        document.getElementById('fontFamilySelect').disabled = !enabled;
        document.getElementById('fontSizeInput').disabled = !enabled;
        document.getElementById('textColorInput').disabled = !enabled;
        document.getElementById('boldCheckbox').disabled = !enabled;
        document.getElementById('italicCheckbox').disabled = !enabled;
        if (inpaintMethodSelect) inpaintMethodSelect.disabled = !enabled;
        if (manualColorCheckbox) manualColorCheckbox.disabled = !enabled;
        if (fillColorInput) fillColorInput.disabled = !enabled || !manualColorCheckbox.checked;

        applyEditBtn.disabled = !enabled;
        if (undoEditBtn) undoEditBtn.disabled = !enabled;

        if (!enabled) {
            selectedInput.value = '';
            document.getElementById('fontSizeInput').value = '';
        }
    }

    // Set Active Page (Show Toolbar & Update Right Panel)
    function setActivePage(index) {
        if (activePageIndex !== null && activePageIndex !== index) {
            const prevToolbar = document.getElementById(`toolbar-${activePageIndex}`);
            if (prevToolbar) prevToolbar.style.visibility = 'hidden';
            if (pageData[activePageIndex].magnifier) toggleMagnifier(activePageIndex, false);

            // Deselect active block if switching pages
            document.querySelectorAll('.bbox.selected').forEach(el => el.classList.remove('selected'));
            currentSelection = null;
        }

        activePageIndex = index;
        const toolbar = document.getElementById(`toolbar-${index}`);
        if (toolbar) toolbar.style.visibility = 'visible';

        // Update Panel Info
        const count = pageData[index] ? pageData[index].blocks.length : 0;
        document.getElementById('regionCount').textContent = `[Page ${index + 1}] ${count} 個文字區域`;
        document.getElementById('selectedId').textContent = '#'; // No block selected

        // Show Panel but Disable controls (Waiting for block selection)
        selectedEdit.style.display = 'block';
        setEditPanelEnabled(false);
    }

    window.analyzePage = async function (pageIndex) {
        setActivePage(pageIndex);
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

                // Refresh Panel Info
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
            container.style.display = pageData[pageIndex].visible ? 'block' : 'none';

            blocks.forEach(block => {
                const div = document.createElement('div');
                div.className = 'bbox';
                div.style.left = (block.bbox[0] * scaleX) + 'px';
                div.style.top = (block.bbox[1] * scaleY) + 'px';
                div.style.width = (block.bbox[2] * scaleX) + 'px';
                div.style.height = (block.bbox[3] * scaleY) + 'px';
                div.style.pointerEvents = 'auto'; // Re-enable clicks
                div.dataset.id = block.id;
                div.title = block.text;

                div.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // If magnifier is on, TURN IT OFF on click
                    if (pageData[pageIndex].magnifier) {
                        toggleMagnifier(pageIndex, false);
                    }

                    // Crucial: Set active page first (updates panel base state), then select block.
                    setActivePage(pageIndex);
                    selectBlock(pageIndex, block.id, div);
                });

                container.appendChild(div);
            });
        }

        if (img.complete && img.naturalWidth > 0) doRender();
        else img.onload = doRender;

        window.removeEventListener('resize', img._resizeHandler);
        img._resizeHandler = doRender;
        window.addEventListener('resize', img._resizeHandler);
    }

    function toggleVisibility(pageIndex) {
        pageData[pageIndex].visible = !pageData[pageIndex].visible;
        const btn = document.getElementById(`visBtn-${pageIndex}`);
        btn.innerHTML = pageData[pageIndex].visible ? ICONS.eye : ICONS.eyeOff;

        const container = document.getElementById(`bboxContainer-${pageIndex}`);
        if (container) container.style.display = pageData[pageIndex].visible ? 'block' : 'none';
    }

    function toggleMagnifier(pageIndex, forceState = null) {
        const currentState = pageData[pageIndex].magnifier;
        const newState = forceState !== null ? forceState : !currentState;

        pageData[pageIndex].magnifier = newState;
        const btn = document.getElementById(`magBtn-${pageIndex}`);
        const lens = document.getElementById(`lens-${pageIndex}`);
        const img = document.getElementById(`pageImg-${pageIndex}`);
        const wrapper = document.getElementById(`pageWrapper-${pageIndex}`);

        if (newState) {
            btn.classList.add('active');
            lens.style.display = 'block';
            wrapper.style.cursor = 'none';

            lens.style.backgroundImage = `url('${img.src}')`;
            const cx = img.naturalWidth / img.offsetWidth;
            const cy = img.naturalHeight / img.offsetHeight;
            let lensSize = 200;
            lens.style.backgroundSize = `${img.naturalWidth}px ${img.naturalHeight}px`;

            const moveHandler = (e) => {
                const rect = img.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Keep lens inside wrapper mostly, or allow intersection.
                lens.style.left = (x - lensSize / 2) + 'px';
                lens.style.top = (y - lensSize / 2) + 'px';

                const bgX = (x * cx) - lensSize / 2;
                const bgY = (y * cy) - lensSize / 2;
                lens.style.backgroundPosition = `-${bgX}px -${bgY}px`;
            };

            wrapper.onmousemove = moveHandler;

            // Add click listener to wrapper to turn off magnifier
            wrapper.onclick = (e) => {
                toggleMagnifier(pageIndex, false);
            };

        } else {
            btn.classList.remove('active');
            lens.style.display = 'none';
            wrapper.style.cursor = 'default';
            wrapper.onmousemove = null;
            wrapper.onclick = null; // Clean up listener
        }
    }


    function selectBlock(pageIndex, blockId, element) {
        document.querySelectorAll('.bbox.selected').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');

        currentSelection = { pageIndex, blockId };
        const block = pageData[pageIndex].blocks.find(b => b.id === blockId);

        // Enable Panel
        selectedEdit.style.display = 'block';
        setEditPanelEnabled(true);

        document.getElementById('selectedId').textContent = `#${blockId}`;

        const mod = pageData[pageIndex].modifications.get(blockId);

        selectedInput.value = mod ? mod.text : block.text;
        document.getElementById('fontFamilySelect').value = mod ? mod.font_family : 'NotoSansTC';
        document.getElementById('fontSizeInput').value = mod ? mod.font_size : '100%';
        document.getElementById('textColorInput').value = mod ? mod.text_color : '#000000';
        document.getElementById('boldCheckbox').checked = mod ? mod.is_bold : false;
        document.getElementById('italicCheckbox').checked = mod ? mod.is_italic : false;

        // Inpaint Settings
        const method = mod ? (mod.inpaint_method || 'lama') : globalInpaintMethod;
        const fillColor = mod ? (mod.fill_color || '#ffffff') : globalFillColor;
        const manualEnabled = mod ? (mod.fill_color !== null) : globalManualColorEnabled; // If mod has color, manual was on.

        if (inpaintMethodSelect) {
            inpaintMethodSelect.value = method;
            simpleFillGroup.style.display = (method === 'simple_filled') ? 'flex' : 'none';
        }

        if (manualColorCheckbox) manualColorCheckbox.checked = manualEnabled;
        if (fillColorInput) {
            fillColorInput.value = fillColor;
            fillColorInput.disabled = !manualEnabled;
        }

        document.getElementById('removeTextCheckbox').checked = false;
        selectedInput.disabled = false;
        if (mod && mod.text === "") {
            document.getElementById('removeTextCheckbox').checked = true;
            selectedInput.disabled = true;

            // If text was removed (""), we should restore the ORIGINAL text in the UI 
            // so if user unchecks it, they see the original text, not empty string.
            // Unless we stashed the custom text? For now, revert to block.text logic.
            selectedInput.value = block.text;
        }

        selectedInput.focus();

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

    async function restorePage(pageIndex) {
        if (!confirm('確定要回復此頁面嗎？所有修改將消失。')) return;

        try {
            pageData[pageIndex].modifications.clear();
            await callUpdatePage(pageIndex);

            const btn = document.getElementById(`restoreBtn-${pageIndex}`);
            if (btn) btn.disabled = true;

            // If a block was selected on this page, revert its values
            if (currentSelection && currentSelection.pageIndex === pageIndex) {
                const block = pageData[pageIndex].blocks.find(b => b.id === currentSelection.blockId);
                if (block) selectBlock(pageIndex, block.id, document.querySelector(`.bbox[data-id="${block.id}"]`));
            }
        } catch (e) {
            console.error(e);
            alert('Error restoring page');
        }
    }

    applyEditBtn.addEventListener('click', async () => {
        if (!currentSelection) return;
        const { pageIndex, blockId } = currentSelection;
        const block = pageData[pageIndex].blocks.find(b => b.id === blockId);

        const isRemove = document.getElementById('removeTextCheckbox').checked;
        const text = isRemove ? "" : selectedInput.value;
        const fontFamily = document.getElementById('fontFamilySelect').value;
        let fontSizeVal = document.getElementById('fontSizeInput').value.trim();
        if (!fontSizeVal) fontSizeVal = "100%";
        if (/^\d+$/.test(fontSizeVal)) fontSizeVal += "%"; // Auto append % if number
        const fontSize = fontSizeVal;
        const textColor = document.getElementById('textColorInput').value;
        const isBold = document.getElementById('boldCheckbox').checked;
        const isItalic = document.getElementById('italicCheckbox').checked;

        const inpaintMethod = inpaintMethodSelect ? inpaintMethodSelect.value : 'lama';
        const isManualColor = manualColorCheckbox && manualColorCheckbox.checked;
        const fillColor = isManualColor ? fillColorInput.value : null;

        pageData[pageIndex].modifications.set(blockId, {
            bbox: block.bbox,
            text: text,
            font_family: fontFamily,
            font_size: fontSize,
            text_color: textColor,
            is_bold: isBold,
            is_italic: isItalic,
            inpaint_method: inpaintMethod,
            fill_color: fillColor
        });

        const originalText = applyEditBtn.textContent;
        applyEditBtn.textContent = 'Applying...';
        applyEditBtn.disabled = true;

        await callUpdatePage(pageIndex);

        applyEditBtn.textContent = originalText;
        applyEditBtn.disabled = false;

        const rBtn = document.getElementById(`restoreBtn-${pageIndex}`);
        if (rBtn) rBtn.disabled = false;

        updateUndoButtonState(true);
    });

    if (undoEditBtn) {
        undoEditBtn.addEventListener('click', async () => {
            if (!currentSelection) return;
            const { pageIndex, blockId } = currentSelection;
            if (pageData[pageIndex].modifications.has(blockId)) {
                pageData[pageIndex].modifications.delete(blockId);
                await callUpdatePage(pageIndex);
                updateUndoButtonState(false);

                const rBtn = document.getElementById(`restoreBtn-${pageIndex}`);
                if (rBtn) rBtn.disabled = pageData[pageIndex].modifications.size === 0;
            }
        });
    }

    async function callUpdatePage(pageIndex) {
        const edits = [];
        pageData[pageIndex].modifications.forEach((mod) => edits.push(mod));

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
                const img = document.getElementById(`pageImg-${pageIndex}`);
                img.src = `${data.image_url}?t=${new Date().getTime()}`;
            } else {
                alert('Update failed: ' + data.detail);
            }
        } catch (e) {
            console.error(e);
            alert('Error updating page');
        }
    }

    function checkModifications() {
        for (const pIdx in pageData) {
            if (pageData[pIdx].modifications.size > 0) return true;
        }
        return false;
    }

    downloadBtn.addEventListener('click', async () => {
        if (!checkModifications()) {
            alert('沒有任何修改，無需下載。\n(No modifications made.)');
            return;
        }
        downloadBtn.textContent = 'Generating...';
        downloadBtn.disabled = true;

        const modifications = [];
        Object.keys(pageData).forEach(pIdx => {
            pageData[pIdx].modifications.forEach((mod) => {
                modifications.push({ page_index: parseInt(pIdx), ...mod });
            });
        });

        try {
            const resp = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId, modifications: modifications })
            });

            const data = await resp.json();
            if (resp.ok) {
                const a = document.createElement('a');
                a.href = data.download_url;
                a.download = 'edited.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => alert('下載完成'), 100);
            } else {
                alert('Generation failed: ' + (data.detail || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Error generating PDF');
        } finally {
            downloadBtn.textContent = '下載 (Download)';
            downloadBtn.disabled = false;
        }
    });

    // Remove legacy toggle button handler if it remained
    const oldToggle = document.getElementById('toggleBoxesBtn');
    if (oldToggle) {
        oldToggle.replaceWith(oldToggle.cloneNode(true)); // remove listeners and hide
        document.getElementById('toggleBoxesBtn').style.display = 'none';
    }
});
