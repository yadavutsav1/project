/* global pdfjsLib, PDFLib */

const pagesContainer = document.getElementById('pagesContainer');
const fileInput = document.getElementById('pdfFiles');
const downloadBtn = document.getElementById('downloadBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const annotateToggle = document.getElementById('annotateToggle');
const annotateTextInput = document.getElementById('annotateText');
const annotateSizeInput = document.getElementById('annotateSize');
const annotateColorInput = document.getElementById('annotateColor');

/**
 * In-memory state for all pages across PDFs.
 * Each item: { id, srcPdfIndex, pdfBytes(Uint8Array), pageNumber, rotation, deleted, annotations: [{x,y,text,size,color}] }
 */
let pageItems = [];
let nextId = 1;

function resetState() {
  pageItems = [];
  nextId = 1;
  pagesContainer.innerHTML = '';
}

function uuid() { return String(nextId++); }

function createPageTile(pageItem) {
  const tile = document.createElement('div');
  tile.className = 'page-tile';
  tile.draggable = true;
  tile.dataset.id = pageItem.id;

  const toolbar = document.createElement('div');
  toolbar.className = 'page-toolbar';

  const left = document.createElement('div');
  left.className = 'left';

  const right = document.createElement('div');
  right.className = 'right';

  const rotateBtn = document.createElement('button');
  rotateBtn.className = 'icon-btn';
  rotateBtn.title = 'Rotate 90°';
  rotateBtn.textContent = '⟲';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn';
  deleteBtn.title = 'Delete/Restore';
  deleteBtn.textContent = '✖';

  const meta = document.createElement('div');
  meta.className = 'page-meta';

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'page-canvas';
  canvasWrap.appendChild(canvas);

  left.appendChild(rotateBtn);
  right.appendChild(deleteBtn);
  toolbar.appendChild(left);
  toolbar.appendChild(right);

  tile.appendChild(toolbar);
  tile.appendChild(canvasWrap);
  tile.appendChild(meta);

  // Drag & drop handlers
  tile.addEventListener('dragstart', (e) => {
    tile.classList.add('dragging');
    e.dataTransfer.setData('text/plain', pageItem.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  tile.addEventListener('dragend', () => tile.classList.remove('dragging'));

  tile.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    tile.classList.add('drop-target');
  });
  tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
  tile.addEventListener('drop', (e) => {
    e.preventDefault();
    tile.classList.remove('drop-target');
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === pageItem.id) return;
    const fromIndex = pageItems.findIndex(p => p.id === draggedId);
    const toIndex = pageItems.findIndex(p => p.id === pageItem.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = pageItems.splice(fromIndex, 1);
    pageItems.splice(toIndex, 0, moved);
    renderAllTiles();
  });

  // Rotate
  rotateBtn.addEventListener('click', async () => {
    pageItem.rotation = (pageItem.rotation + 90) % 360;
    await renderPageIntoCanvas(pageItem, canvas);
    updateMeta(meta, pageItem);
  });

  // Delete/restore
  deleteBtn.addEventListener('click', () => {
    pageItem.deleted = !pageItem.deleted;
    tile.style.opacity = pageItem.deleted ? 0.4 : 1;
    deleteBtn.classList.toggle('active', pageItem.deleted);
    updateMeta(meta, pageItem);
  });

  // Annotate placement
  canvas.addEventListener('click', async (e) => {
    if (!annotateToggle.checked) return;
    const text = annotateTextInput.value || '';
    if (!text) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert from canvas pixels to normalized (0..1) coords to be resolution independent
    const nx = x / canvas.width;
    const ny = y / canvas.height;

    pageItem.annotations.push({
      x: nx,
      y: ny,
      text,
      size: Number(annotateSizeInput.value || 18),
      color: annotateColorInput.value || '#000000'
    });

    await renderPageIntoCanvas(pageItem, canvas);
  });

  // Initial render
  renderPageIntoCanvas(pageItem, canvas).then(() => updateMeta(meta, pageItem));

  return tile;
}

function updateMeta(metaEl, pageItem) {
  const status = pageItem.deleted ? 'Deleted' : 'Active';
  metaEl.textContent = `PDF ${pageItem.srcPdfIndex + 1} • Page ${pageItem.pageNumber} • Rot ${pageItem.rotation}° • ${status}`;
}

async function renderPageIntoCanvas(pageItem, canvas) {
  // Render PDF page with pdf.js then draw annotations
  const pdf = await pdfjsLib.getDocument({ data: pageItem.pdfBytes }).promise;
  const page = await pdf.getPage(pageItem.pageNumber);

  // Determine viewport considering rotation
  const rotate = pageItem.rotation;
  const viewport = page.getViewport({ scale: 1, rotation: rotate });

  // Choose a scale so width ~ 220px
  const targetWidth = 220;
  const scale = targetWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale, rotation: rotate });

  const context = canvas.getContext('2d');
  canvas.width = Math.ceil(scaledViewport.width);
  canvas.height = Math.ceil(scaledViewport.height);

  await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

  // Draw text annotations on canvas preview
  for (const ann of pageItem.annotations) {
    const cx = ann.x * canvas.width;
    const cy = ann.y * canvas.height;
    context.fillStyle = ann.color || '#000';
    context.font = `${ann.size}px sans-serif`;
    context.textBaseline = 'top';
    context.fillText(ann.text, cx, cy);
  }
}

async function handleFiles(files) {
  const fileArr = Array.from(files || []);
  if (!fileArr.length) return;

  let srcIndexOffset = new Set(pageItems.map(p => p.srcPdfIndex)).size;

  for (const [i, file] of fileArr.entries()) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const item = {
        id: uuid(),
        srcPdfIndex: srcIndexOffset + i,
        pdfBytes,
        pageNumber: pageNum,
        rotation: 0,
        deleted: false,
        annotations: [],
      };
      pageItems.push(item);
    }
  }

  renderAllTiles();
}

function renderAllTiles() {
  pagesContainer.innerHTML = '';
  for (const item of pageItems) {
    const tile = createPageTile(item);
    pagesContainer.appendChild(tile);
  }
}

async function exportMergedPdf() {
  const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;
  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);

  // Group source byte arrays to avoid re-embedding per page
  const bytesKeyToDoc = new Map();

  const activePages = pageItems.filter(p => !p.deleted);
  if (!activePages.length) {
    alert('No pages to export');
    return;
  }

  for (const item of activePages) {
    let srcDoc = bytesKeyToDoc.get(item.pdfBytes);
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(item.pdfBytes);
      bytesKeyToDoc.set(item.pdfBytes, srcDoc);
    }

    const [copiedPage] = await outDoc.copyPages(srcDoc, [item.pageNumber - 1]);

    // Apply rotation
    if (item.rotation) {
      copiedPage.setRotation(degrees(item.rotation));
    }

    outDoc.addPage(copiedPage);

    // Draw annotations on that page in document coordinates
    const { width, height } = copiedPage.getSize();
    for (const ann of item.annotations) {
      const x = ann.x * width;
      // Convert top-origin canvas Y to bottom-origin PDF Y
      const y = height - ann.y * height - ann.size;

      // Convert CSS hex color to rgb()
      const { r, g, b } = hexToRgb(ann.color || '#000000');
      copiedPage.drawText(ann.text, {
        x,
        y,
        size: ann.size,
        color: rgb(r / 255, g / 255, b / 255),
        font,
      });
    }
  }

  const mergedBytes = await outDoc.save();
  const blob = new Blob([mergedBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'merged.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Drag and drop files onto the window
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files) {
    const onlyPdfs = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    handleFiles(onlyPdfs);
  }
});

clearAllBtn.addEventListener('click', () => {
  resetState();
});

downloadBtn.addEventListener('click', () => {
  exportMergedPdf().catch(err => {
    console.error(err);
    alert('Failed to export PDF. See console for details.');
  });
});