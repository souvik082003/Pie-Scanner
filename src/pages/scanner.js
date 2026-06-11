// ============================================
// ScanPro — Scanner Page (Enhanced)
// Per-page editing: Filters, Crop, Rotate, Watermark
// Mobile-friendly page reorder
// ============================================

import { PDFDocument } from 'pdf-lib';
import i18n from '../i18n.js';
import toast from '../toast.js';
import store from '../store.js';
import { readFileAsDataURL, compressImage, loadImage, downloadBlob, createFileInput, uid } from '../utils.js';

let pages = []; // { id, dataUrl, name }
let cameraStream = null;
let currentMode = 'upload'; // 'camera' or 'upload'

// Editor state
let editingPageId = null;
let editCanvas = null;
let editActiveTool = 'filters';
let editActiveFilter = 'original';
let editOriginalDataUrl = null;
let editCropState = null;

const SCAN_FILTERS = [
  { key: 'original', css: 'none', label: 'Original' },
  { key: 'vibrant', css: 'saturate(1.5) contrast(1.1) brightness(1.05)', label: 'Vibrant' },
  { key: 'softTone', css: 'brightness(1.05) saturate(0.9) sepia(0.1)', label: 'Soft Tone' },
  { key: 'sharpBW', css: 'grayscale(1) contrast(1.4)', label: 'B&W' },
  { key: 'enhance', css: 'contrast(1.15) brightness(1.05) saturate(1.1)', label: 'Enhance' },
  { key: 'document', css: 'grayscale(0.3) contrast(1.3) brightness(1.1)', label: 'Document' },
];

const t = (key) => i18n.t(key);

export function render() {
  return `
    <div class="scanner-container animate-fade-in-up">
      <div class="page-header">
        <h1 data-i18n="scanner.title">${t('scanner.title')}</h1>
        <p data-i18n="scanner.subtitle">${t('scanner.subtitle')}</p>
      </div>

      <!-- Mode Selection -->
      <div class="scanner-modes">
        <button class="scanner-mode-btn ${currentMode === 'camera' ? 'active' : ''}" id="mode-camera" data-mode="camera">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span data-i18n="scanner.mode.camera">${t('scanner.mode.camera')}</span>
        </button>
        <button class="scanner-mode-btn ${currentMode === 'upload' ? 'active' : ''}" id="mode-upload" data-mode="upload">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span data-i18n="scanner.mode.upload">${t('scanner.mode.upload')}</span>
        </button>
      </div>

      <!-- Camera View -->
      <div id="camera-section" class="camera-section" style="display:${currentMode === 'camera' ? 'block' : 'none'}">
        <div class="camera-container" id="camera-container">
          <video id="camera-video" autoplay playsinline></video>
          <canvas id="camera-canvas" style="display:none;"></canvas>
          <div class="camera-controls" id="camera-controls" style="display:none;">
            <!-- Thumbnail stack (Left) -->
            <button class="camera-thumbnail-btn" id="camera-thumbnail-btn" style="visibility: hidden;">
              <img id="camera-thumbnail-img" src="" alt="Latest capture" />
              <div class="camera-badge" id="camera-badge">0</div>
            </button>

            <!-- Large Capture Button (Center) -->
            <button class="capture-btn" id="capture-btn" title="${t('scanner.camera.capture')}"></button>
            
            <!-- Finish / Tick Button (Right) -->
            <button class="camera-done-btn" id="camera-done-btn" title="${t('common.done')}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            
            <!-- Hide switch button, move to top if needed, but for now we'll just keep it hidden or add a top bar later. Let's keep it minimal as requested. -->
          </div>
          <div id="camera-placeholder" class="empty-state" style="padding: var(--space-8);">
            <button class="btn btn-primary btn-lg" id="start-camera">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span data-i18n="scanner.camera.start">${t('scanner.camera.start')}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Upload Section -->
      <div id="upload-section" style="display:${currentMode === 'upload' ? 'block' : 'none'}">
        <div class="dropzone" id="scanner-dropzone">
          <div class="dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div class="dropzone-text">
            <h3 data-i18n="scanner.dropzone.title">${t('scanner.dropzone.title')}</h3>
            <p data-i18n="scanner.dropzone.subtitle">${t('scanner.dropzone.subtitle')}</p>
            <button class="btn btn-primary mt-4" id="browse-files">
              <span data-i18n="scanner.dropzone.browse">${t('scanner.dropzone.browse')}</span>
            </button>
          </div>
          <input type="file" id="file-input" accept="image/*" multiple style="display:none;" />
        </div>
      </div>

      <!-- Pages Preview -->
      <div id="pages-section" style="display:${pages.length > 0 ? 'block' : 'none'}">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">
            <span data-i18n="scanner.pages">${t('scanner.pages')}</span>
            <span class="badge badge-primary ml-2" id="page-count">${pages.length}</span>
          </h3>
          <button class="btn btn-ghost btn-sm" id="clear-all" style="display:${pages.length > 0 ? 'inline-flex' : 'none'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span data-i18n="scanner.clearAll">${t('scanner.clearAll')}</span>
          </button>
        </div>
        <p class="text-xs text-secondary mb-4">${t('scanner.reorder')}</p>
        <div class="scan-pages-grid" id="pages-grid">
          ${renderPagesGrid()}
        </div>
      </div>

      <!-- PDF Settings -->
      <div id="settings-section" style="display:${pages.length > 0 ? 'block' : 'none'}">
        <h3 class="text-lg font-semibold mb-4" data-i18n="scanner.settings">${t('scanner.settings')}</h3>
        <div class="page-settings">
          <div class="input-group">
            <label data-i18n="scanner.pageSize">${t('scanner.pageSize')}</label>
            <select class="select" id="page-size">
              <option value="a4">A4 (210 × 297 mm)</option>
              <option value="letter">Letter (8.5 × 11 in)</option>
              <option value="legal">Legal (8.5 × 14 in)</option>
              <option value="a3">A3 (297 × 420 mm)</option>
              <option value="a5">A5 (148 × 210 mm)</option>
            </select>
          </div>
          <div class="input-group">
            <label data-i18n="scanner.orientation">${t('scanner.orientation')}</label>
            <select class="select" id="page-orientation">
              <option value="auto" data-i18n="scanner.orientation.auto">${t('scanner.orientation.auto')}</option>
              <option value="portrait" data-i18n="scanner.orientation.portrait">${t('scanner.orientation.portrait')}</option>
              <option value="landscape" data-i18n="scanner.orientation.landscape">${t('scanner.orientation.landscape')}</option>
            </select>
          </div>
          <div class="input-group">
            <label data-i18n="scanner.quality">${t('scanner.quality')}</label>
            <input type="range" class="range-slider" id="image-quality" min="30" max="100" value="80" />
            <span class="text-xs text-secondary" id="quality-label">80%</span>
          </div>
          <div class="input-group">
            <label data-i18n="scanner.margins">${t('scanner.margins')}</label>
            <select class="select" id="page-margins">
              <option value="none">None</option>
              <option value="small" selected>Small (10mm)</option>
              <option value="medium">Medium (20mm)</option>
              <option value="large">Large (30mm)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Generate Button -->
      <div class="action-bar" id="action-bar" style="display:${pages.length > 0 ? 'flex' : 'none'}">
        <button class="btn btn-primary btn-lg btn-block" id="generate-pdf">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span data-i18n="scanner.generate">${t('scanner.generate')}</span>
        </button>
      </div>
    </div>

    <!-- Page Editor Overlay -->
    <div class="scan-editor-overlay" id="scan-editor-overlay" style="display:none">
      <div class="scan-editor-header">
        <button class="btn btn-ghost btn-sm" id="scan-editor-cancel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ${t('common.cancel')}
        </button>
        <span class="scan-editor-title">${t('scanner.edit.title') !== 'scanner.edit.title' ? t('scanner.edit.title') : 'Edit Page'}</span>
        <button class="btn btn-primary btn-sm" id="scan-editor-done">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          ${t('common.done')}
        </button>
      </div>
      <div class="scan-editor-canvas-area" id="scan-editor-canvas-area">
        <canvas id="scan-editor-canvas"></canvas>
      </div>
      <div class="scan-editor-tool-panel" id="scan-editor-tool-panel"></div>
      <div class="scan-editor-filter-bar" id="scan-editor-filter-bar"></div>
      <div class="scan-editor-toolbar">
        <button class="scan-tool-btn active" data-tool="filters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
          <span>Filters</span>
        </button>
        <button class="scan-tool-btn" data-tool="crop">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>
          <span>Crop</span>
        </button>
        <button class="scan-tool-btn" data-tool="rotate">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span>Rotate</span>
        </button>
        <button class="scan-tool-btn" data-tool="watermark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Watermark</span>
        </button>
      </div>
    </div>
  `;
}

function renderPagesGrid() {
  return pages.map((page, i) => `
    <div class="scan-page-card animate-scale-in" data-id="${page.id}">
      <div class="scan-page-thumb" data-edit="${page.id}">
        <span class="scan-page-num">${i + 1}</span>
        <img src="${page.dataUrl}" alt="Page ${i + 1}" loading="lazy" />
        <div class="scan-page-edit-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
      </div>
      <div class="scan-page-actions">
        <button class="scan-page-action-btn" data-move-up="${page.id}" title="Move up" ${i === 0 ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="scan-page-action-btn" data-move-down="${page.id}" title="Move down" ${i === pages.length - 1 ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="scan-page-action-btn scan-page-delete-btn" data-remove="${page.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

export function init() {
  setupDropzone();
  setupCamera();
  setupModeToggle();
  setupPages();
  setupGenerate();
  setupQualitySlider();
  setupEditorOverlay();
  
  if (localStorage.getItem('auto-start-camera') === 'true') {
    localStorage.removeItem('auto-start-camera');
    currentMode = 'camera';
    document.querySelectorAll('.scanner-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === 'camera');
    });
    document.getElementById('camera-section').style.display = 'block';
    document.getElementById('upload-section').style.display = 'none';
    
    // Slight delay to ensure DOM is ready before requesting camera
    setTimeout(() => {
      const startBtn = document.getElementById('start-camera');
      if (startBtn) startBtn.click();
    }, 100);
  }
}


function setupModeToggle() {
  document.querySelectorAll('.scanner-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      currentMode = mode;
      document.querySelectorAll('.scanner-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('camera-section').style.display = mode === 'camera' ? 'block' : 'none';
      document.getElementById('upload-section').style.display = mode === 'upload' ? 'block' : 'none';
      if (mode !== 'camera' && cameraStream) {
        stopCamera();
      }
    });
  });
}

function setupDropzone() {
  const dropzone = document.getElementById('scanner-dropzone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-files');

  if (!dropzone) return;

  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) await addFiles(files);
  });

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) await addFiles(files);
    fileInput.value = '';
  });
}

async function addFiles(files) {
  for (const file of files) {
    try {
      const dataUrl = await readFileAsDataURL(file);
      pages.push({ id: uid(), dataUrl, name: file.name });
    } catch (err) {
      toast.error(`Failed to load ${file.name}`);
    }
  }
  updatePagesUI();
  toast.success(i18n.t('common.success'));
}

function setupCamera() {
  const startBtn = document.getElementById('start-camera');
  const captureBtn = document.getElementById('capture-btn');
  const doneBtn = document.getElementById('camera-done-btn');

  startBtn?.addEventListener('click', startCamera);
  captureBtn?.addEventListener('click', capturePhoto);
  doneBtn?.addEventListener('click', finishScanning);
  
  // We'll add a way to switch camera later if needed, but keeping UI clean for now.
}

let facingMode = 'environment';

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    const video = document.getElementById('camera-video');
    video.srcObject = cameraStream;
    video.play().catch(console.error);
    document.getElementById('camera-controls').style.display = 'flex';
    document.getElementById('camera-placeholder').style.display = 'none';
    
    // Reset thumbnail UI on start if no pages
    updateCameraThumbnail();
  } catch (err) {
    toast.error(i18n.t('scanner.camera.error'));
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) video.srcObject = null;
  const controls = document.getElementById('camera-controls');
  if (controls) controls.style.display = 'none';
  const placeholder = document.getElementById('camera-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
}

function updateCameraThumbnail() {
  const thumbBtn = document.getElementById('camera-thumbnail-btn');
  const thumbImg = document.getElementById('camera-thumbnail-img');
  const badge = document.getElementById('camera-badge');
  const doneBtn = document.getElementById('camera-done-btn');
  
  if (pages.length > 0) {
    thumbBtn.style.visibility = 'visible';
    thumbImg.src = pages[pages.length - 1].dataUrl;
    badge.textContent = pages.length;
    doneBtn.style.visibility = 'visible';
  } else {
    thumbBtn.style.visibility = 'hidden';
    doneBtn.style.visibility = 'hidden';
  }
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  pages.push({ id: uid(), dataUrl, name: `Capture_${pages.length + 1}.jpg` });

  // Flash effect
  const captureBtn = document.getElementById('capture-btn');
  captureBtn.classList.add('flash');
  setTimeout(() => captureBtn.classList.remove('flash'), 300);

  updateCameraThumbnail();
  toast.success(`Page ${pages.length} captured`);
}

function finishScanning() {
  stopCamera();
  updatePagesUI();
  
  // Transition UI
  document.getElementById('camera-section').style.display = 'none';
  document.getElementById('pages-section').style.display = 'block';
  document.getElementById('settings-section').style.display = 'block';
  document.getElementById('action-bar').style.display = 'flex';
  
  // Scroll down to pages area
  document.getElementById('pages-section').scrollIntoView({ behavior: 'smooth' });
}

function setupPages() {
  // Event delegation for all page actions
  document.getElementById('page-content')?.addEventListener('click', (e) => {
    // Remove page
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      const id = removeBtn.dataset.remove;
      pages = pages.filter(p => p.id !== id);
      updatePagesUI();
      return;
    }

    // Move up
    const moveUpBtn = e.target.closest('[data-move-up]');
    if (moveUpBtn) {
      const id = moveUpBtn.dataset.moveUp;
      const idx = pages.findIndex(p => p.id === id);
      if (idx > 0) {
        [pages[idx - 1], pages[idx]] = [pages[idx], pages[idx - 1]];
        updatePagesUI();
      }
      return;
    }

    // Move down
    const moveDownBtn = e.target.closest('[data-move-down]');
    if (moveDownBtn) {
      const id = moveDownBtn.dataset.moveDown;
      const idx = pages.findIndex(p => p.id === id);
      if (idx < pages.length - 1) {
        [pages[idx], pages[idx + 1]] = [pages[idx + 1], pages[idx]];
        updatePagesUI();
      }
      return;
    }

    // Edit page (tap thumbnail)
    const editThumb = e.target.closest('[data-edit]');
    if (editThumb) {
      const id = editThumb.dataset.edit;
      openPageEditor(id);
      return;
    }
  });

  // Clear all
  document.getElementById('clear-all')?.addEventListener('click', () => {
    pages = [];
    updatePagesUI();
  });
}

function updatePagesUI() {
  const pagesSection = document.getElementById('pages-section');
  const settingsSection = document.getElementById('settings-section');
  const actionBar = document.getElementById('action-bar');
  const pageCount = document.getElementById('page-count');
  const clearAll = document.getElementById('clear-all');
  const pagesGrid = document.getElementById('pages-grid');

  if (!pagesSection) return;

  const show = pages.length > 0;
  pagesSection.style.display = show ? 'block' : 'none';
  settingsSection.style.display = show ? 'block' : 'none';
  actionBar.style.display = show ? 'flex' : 'none';

  if (pageCount) pageCount.textContent = pages.length;
  if (clearAll) clearAll.style.display = show ? 'inline-flex' : 'none';

  if (pagesGrid) {
    pagesGrid.innerHTML = renderPagesGrid();
  }
}

function setupQualitySlider() {
  const slider = document.getElementById('image-quality');
  const label = document.getElementById('quality-label');
  if (slider && label) {
    slider.addEventListener('input', () => {
      label.textContent = slider.value + '%';
    });
  }
}

function setupGenerate() {
  document.getElementById('generate-pdf')?.addEventListener('click', generatePDF);
}

// =============================================
// PAGE EDITOR
// =============================================
function setupEditorOverlay() {
  const overlay = document.getElementById('scan-editor-overlay');
  if (!overlay) return;

  // Cancel
  document.getElementById('scan-editor-cancel')?.addEventListener('click', closePageEditor);

  // Done — save edit
  document.getElementById('scan-editor-done')?.addEventListener('click', () => {
    const canvas = document.getElementById('scan-editor-canvas');
    if (canvas && editingPageId) {
      const page = pages.find(p => p.id === editingPageId);
      if (page) {
        page.dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        updatePagesUI();
      }
    }
    closePageEditor();
    toast.success(t('common.success'));
  });

  // Tool switching
  overlay.querySelectorAll('.scan-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editActiveTool = btn.dataset.tool;
      updateEditorToolUI();
    });
  });
}

function openPageEditor(pageId) {
  const page = pages.find(p => p.id === pageId);
  if (!page) return;

  editingPageId = pageId;
  editOriginalDataUrl = page.dataUrl;
  editActiveTool = 'filters';
  editActiveFilter = 'original';

  const overlay = document.getElementById('scan-editor-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // Draw image to canvas
  const canvas = document.getElementById('scan-editor-canvas');
  if (canvas) {
    drawToEditorCanvas(canvas, page.dataUrl);
  }

  updateEditorToolUI();
}

function closePageEditor() {
  editingPageId = null;
  editOriginalDataUrl = null;

  // Remove crop overlay if exists
  const area = document.getElementById('scan-editor-canvas-area');
  const cropOv = area?.querySelector('.crop-overlay');
  if (cropOv) {
    if (cropOv._cleanup) cropOv._cleanup();
    else cropOv.remove();
  }

  const overlay = document.getElementById('scan-editor-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
}

async function drawToEditorCanvas(canvas, src) {
  const img = await loadImage(src);
  const area = canvas.parentElement;
  const maxW = area?.clientWidth || 360;
  const maxH = area?.clientHeight || 400;

  let w = img.width, h = img.height;
  if (w > maxW) { h = (h * maxW) / w; w = maxW; }
  if (h > maxH) { w = (w * maxH) / h; h = maxH; }

  canvas.width = img.width;
  canvas.height = img.height;
  canvas.style.width = Math.round(w) + 'px';
  canvas.style.height = Math.round(h) + 'px';

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
}

function updateEditorToolUI() {
  // Remove crop overlay if switching away
  const area = document.getElementById('scan-editor-canvas-area');
  if (area) {
    const cropOv = area.querySelector('.crop-overlay');
    if (cropOv && editActiveTool !== 'crop') {
      if (cropOv._cleanup) cropOv._cleanup();
      else cropOv.remove();
    }
  }

  // Update toolbar active states
  document.querySelectorAll('.scan-tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === editActiveTool);
  });

  // Update filter bar
  const filterBar = document.getElementById('scan-editor-filter-bar');
  if (filterBar) {
    filterBar.innerHTML = editActiveTool === 'filters' ? renderEditorFilterBar() : '';
    if (editActiveTool === 'filters') setupEditorFilterListeners();
  }

  // Update tool panel
  const panel = document.getElementById('scan-editor-tool-panel');
  if (panel) {
    panel.innerHTML = renderEditorToolPanel();
    setupEditorToolPanelListeners();
  }
}

function renderEditorFilterBar() {
  const page = pages.find(p => p.id === editingPageId);
  const thumbSrc = page ? page.dataUrl : '';

  return `
    <div class="scan-filter-strip">
      ${SCAN_FILTERS.map(f => `
        <div class="scan-filter-item ${editActiveFilter === f.key ? 'active' : ''}" data-filter="${f.key}">
          <div class="scan-filter-thumb">
            <img src="${thumbSrc}" alt="${f.label}" style="filter: ${f.css}" />
          </div>
          <span>${f.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function setupEditorFilterListeners() {
  const strip = document.querySelector('.scan-filter-strip');
  if (!strip) return;

  strip.addEventListener('click', async (e) => {
    const item = e.target.closest('.scan-filter-item');
    if (!item) return;
    const filterKey = item.dataset.filter;
    if (!filterKey || !editOriginalDataUrl) return;

    editActiveFilter = filterKey;

    // Apply filter to canvas
    const canvas = document.getElementById('scan-editor-canvas');
    if (!canvas) return;

    try {
      const img = await loadImage(editOriginalDataUrl);
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      const filter = SCAN_FILTERS.find(f => f.key === filterKey);
      ctx.filter = filter ? filter.css : 'none';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    } catch (err) {
      console.error('Filter error:', err);
    }

    // Update active state
    strip.querySelectorAll('.scan-filter-item').forEach(f => f.classList.remove('active'));
    item.classList.add('active');
  });
}

function renderEditorToolPanel() {
  switch (editActiveTool) {
    case 'crop':
      return `
        <div class="scan-tool-panel-inner">
          <button class="btn btn-secondary btn-sm" id="scan-crop-cancel">✕ Cancel</button>
          <button class="btn btn-primary btn-sm" id="scan-crop-apply">✓ Apply</button>
        </div>
      `;
    case 'rotate':
      return `
        <div class="scan-tool-panel-inner">
          <button class="btn btn-secondary btn-sm" id="scan-rotate-left">↺ 90° Left</button>
          <button class="btn btn-secondary btn-sm" id="scan-rotate-right">↻ 90° Right</button>
        </div>
      `;
    case 'watermark':
      return `
        <div class="scan-tool-panel-inner scan-wm-panel">
          <input type="text" class="input" id="scan-wm-text" placeholder="e.g. CONFIDENTIAL" />
          <button class="btn btn-primary btn-sm" id="scan-wm-apply">Apply</button>
        </div>
      `;
    default:
      return '';
  }
}

function setupEditorToolPanelListeners() {
  // Rotate
  document.getElementById('scan-rotate-left')?.addEventListener('click', () => rotateEditorCanvas(-90));
  document.getElementById('scan-rotate-right')?.addEventListener('click', () => rotateEditorCanvas(90));

  // Watermark
  document.getElementById('scan-wm-apply')?.addEventListener('click', () => {
    const text = document.getElementById('scan-wm-text')?.value;
    if (!text) return;
    const canvas = document.getElementById('scan-editor-canvas');
    if (!canvas) return;
    addWatermarkToCanvas(canvas, text);
    toast.success('Watermark applied');
  });

  // Crop
  if (editActiveTool === 'crop') {
    setupEditorCrop();
  }
}

async function rotateEditorCanvas(degrees) {
  const canvas = document.getElementById('scan-editor-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCanvas.getContext('2d').putImageData(imgData, 0, 0);

  if (Math.abs(degrees) === 90) {
    canvas.width = tempCanvas.height;
    canvas.height = tempCanvas.width;
  }

  const newCtx = canvas.getContext('2d');
  newCtx.save();
  newCtx.translate(canvas.width / 2, canvas.height / 2);
  newCtx.rotate((degrees * Math.PI) / 180);
  newCtx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
  newCtx.restore();

  // Update display size
  const area = canvas.parentElement;
  const maxW = area?.clientWidth || 360;
  const maxH = area?.clientHeight || 400;
  let w = canvas.width, h = canvas.height;
  if (w > maxW) { h = (h * maxW) / w; w = maxW; }
  if (h > maxH) { w = (w * maxH) / h; h = maxH; }
  canvas.style.width = Math.round(w) + 'px';
  canvas.style.height = Math.round(h) + 'px';

  // Update original for filter re-application
  editOriginalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
}

function addWatermarkToCanvas(canvas, text) {
  const ctx = canvas.getContext('2d');
  const fontSize = Math.max(16, canvas.width / 15);
  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.textAlign = 'center';

  const stepX = fontSize * 8;
  const stepY = fontSize * 4;

  for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
    for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-25 * Math.PI / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();

  // Update original
  editOriginalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
}

// ---- Crop Tool for Scanner Editor ----
function setupEditorCrop() {
  const canvas = document.getElementById('scan-editor-canvas');
  const area = document.getElementById('scan-editor-canvas-area');
  if (!canvas || !area) return;

  // Remove existing
  const existing = area.querySelector('.crop-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = `
    <div class="crop-mask crop-mask-top"></div>
    <div class="crop-mask crop-mask-bottom"></div>
    <div class="crop-mask crop-mask-left"></div>
    <div class="crop-mask crop-mask-right"></div>
    <div class="crop-selection" id="scan-crop-sel">
      <div class="crop-grid">
        <div class="crop-grid-line crop-grid-h1"></div>
        <div class="crop-grid-line crop-grid-h2"></div>
        <div class="crop-grid-line crop-grid-v1"></div>
        <div class="crop-grid-line crop-grid-v2"></div>
      </div>
      <div class="crop-handle crop-handle-tl" data-handle="tl"></div>
      <div class="crop-handle crop-handle-tr" data-handle="tr"></div>
      <div class="crop-handle crop-handle-bl" data-handle="bl"></div>
      <div class="crop-handle crop-handle-br" data-handle="br"></div>
      <div class="crop-handle crop-handle-t" data-handle="t"></div>
      <div class="crop-handle crop-handle-b" data-handle="b"></div>
      <div class="crop-handle crop-handle-l" data-handle="l"></div>
      <div class="crop-handle crop-handle-r" data-handle="r"></div>
    </div>
  `;
  area.appendChild(overlay);

  const INSET = 0.08;
  editCropState = { left: INSET, top: INSET, right: 1 - INSET, bottom: 1 - INSET };

  function updateUI() {
    const sel = overlay.querySelector('.crop-selection');
    const mT = overlay.querySelector('.crop-mask-top');
    const mB = overlay.querySelector('.crop-mask-bottom');
    const mL = overlay.querySelector('.crop-mask-left');
    const mR = overlay.querySelector('.crop-mask-right');
    const l = editCropState.left * 100, tp = editCropState.top * 100;
    const r = editCropState.right * 100, b = editCropState.bottom * 100;
    sel.style.left = l+'%'; sel.style.top = tp+'%';
    sel.style.width = (r-l)+'%'; sel.style.height = (b-tp)+'%';
    mT.style.cssText = `top:0;left:0;right:0;height:${tp}%`;
    mB.style.cssText = `bottom:0;left:0;right:0;height:${100-b}%`;
    mL.style.cssText = `top:${tp}%;left:0;width:${l}%;height:${b-tp}%`;
    mR.style.cssText = `top:${tp}%;right:0;width:${100-r}%;height:${b-tp}%`;
  }
  updateUI();

  let dragMode = null, startTouch = null, startCrop = null;

  function getRelPos(e) {
    const rect = overlay.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const cx = touch ? touch.clientX : e.clientX;
    const cy = touch ? touch.clientY : e.clientY;
    return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height };
  }

  function onStart(e) {
    e.preventDefault(); e.stopPropagation();
    const handle = e.target.closest('.crop-handle');
    const sel = e.target.closest('.crop-selection');
    if (handle) dragMode = handle.dataset.handle;
    else if (sel) dragMode = 'move';
    else return;
    startTouch = getRelPos(e);
    startCrop = { ...editCropState };
  }

  function onMove(e) {
    if (!dragMode) return;
    e.preventDefault(); e.stopPropagation();
    const pos = getRelPos(e);
    const dx = pos.x - startTouch.x, dy = pos.y - startTouch.y;
    const MIN = 0.1;
    if (dragMode === 'move') {
      const w = startCrop.right - startCrop.left, h = startCrop.bottom - startCrop.top;
      editCropState.left = Math.max(0, Math.min(1-w, startCrop.left+dx));
      editCropState.top = Math.max(0, Math.min(1-h, startCrop.top+dy));
      editCropState.right = editCropState.left + w;
      editCropState.bottom = editCropState.top + h;
    } else {
      let {left,top,right,bottom} = startCrop;
      if (dragMode.includes('l')) left = Math.max(0, Math.min(right-MIN, startCrop.left+dx));
      if (dragMode.includes('r')||dragMode==='r') right = Math.min(1, Math.max(left+MIN, startCrop.right+dx));
      if (dragMode.includes('t')||dragMode==='t') top = Math.max(0, Math.min(bottom-MIN, startCrop.top+dy));
      if (dragMode.includes('b')||dragMode==='b') bottom = Math.min(1, Math.max(top+MIN, startCrop.bottom+dy));
      if (dragMode==='t'||dragMode==='b'){left=startCrop.left;right=startCrop.right;}
      if (dragMode==='l'||dragMode==='r'){top=startCrop.top;bottom=startCrop.bottom;}
      editCropState = {left,top,right,bottom};
    }
    updateUI();
  }

  function onEnd(e) { if(dragMode) e?.preventDefault?.(); dragMode=null; startTouch=null; startCrop=null; }

  overlay.addEventListener('mousedown', onStart);
  overlay.addEventListener('touchstart', onStart, {passive:false});
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);

  overlay._cleanup = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);
    overlay.remove();
  };

  // Apply crop
  document.getElementById('scan-crop-apply')?.addEventListener('click', () => {
    if (!editCropState) return;
    const x = Math.round(editCropState.left * canvas.width);
    const y = Math.round(editCropState.top * canvas.height);
    const w = Math.round((editCropState.right - editCropState.left) * canvas.width);
    const h = Math.round((editCropState.bottom - editCropState.top) * canvas.height);
    if (w < 10 || h < 10) return;

    const imgData = canvas.getContext('2d').getImageData(x, y, w, h);
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').putImageData(imgData, 0, 0);

    // Update display size
    const areaEl = canvas.parentElement;
    const maxW = areaEl?.clientWidth || 360;
    const maxH2 = areaEl?.clientHeight || 400;
    let dw = w, dh = h;
    if (dw > maxW) { dh = (dh * maxW) / dw; dw = maxW; }
    if (dh > maxH2) { dw = (dw * maxH2) / dh; dh = maxH2; }
    canvas.style.width = Math.round(dw) + 'px';
    canvas.style.height = Math.round(dh) + 'px';

    overlay._cleanup();
    editCropState = null;
    editOriginalDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    editActiveTool = 'filters';
    updateEditorToolUI();
    toast.success('Cropped');
  });

  // Cancel crop
  document.getElementById('scan-crop-cancel')?.addEventListener('click', () => {
    overlay._cleanup();
    editCropState = null;
    editActiveTool = 'filters';
    updateEditorToolUI();
  });
}

// =============================================
// PDF GENERATION
// =============================================
const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
};

const MARGINS = {
  none: 0,
  small: 28.35,  // 10mm
  medium: 56.7,  // 20mm
  large: 85.05,  // 30mm
};

async function generatePDF() {
  if (pages.length === 0) return;

  const btn = document.getElementById('generate-pdf');
  const btnText = btn.querySelector('span');
  const originalText = btnText.textContent;
  btn.disabled = true;
  btnText.textContent = i18n.t('scanner.generating');

  try {
    const pdfDoc = await PDFDocument.create();
    const pageSize = document.getElementById('page-size').value;
    const orientation = document.getElementById('page-orientation').value;
    const quality = parseInt(document.getElementById('image-quality').value) / 100;
    const margin = MARGINS[document.getElementById('page-margins').value];

    const [baseW, baseH] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;

    for (const pageData of pages) {
      // Compress image
      const compressed = await compressImage(pageData.dataUrl, quality, 3000);
      const img = await loadImage(compressed);

      // Determine orientation
      let w = baseW, h = baseH;
      if (orientation === 'auto') {
        if (img.width > img.height) { w = baseH; h = baseW; }
      } else if (orientation === 'landscape') {
        w = baseH; h = baseW;
      }

      const page = pdfDoc.addPage([w, h]);
      const imgBytes = await fetch(compressed).then(r => r.arrayBuffer());
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);

      const drawW = w - margin * 2;
      const drawH = h - margin * 2;

      // Fit image to page
      const imgAspect = embeddedImg.width / embeddedImg.height;
      const pageAspect = drawW / drawH;

      let finalW, finalH;
      if (imgAspect > pageAspect) {
        finalW = drawW;
        finalH = drawW / imgAspect;
      } else {
        finalH = drawH;
        finalW = drawH * imgAspect;
      }

      const x = margin + (drawW - finalW) / 2;
      const y = margin + (drawH - finalH) / 2;

      page.drawImage(embeddedImg, { x, y, width: finalW, height: finalH });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `PieScanner_${new Date().toISOString().slice(0, 10)}.pdf`);

    // Save to history
    await store.addHistory({
      type: 'scan',
      name: `Scan_${pages.length}_pages.pdf`,
      size: pdfBytes.length,
      pageCount: pages.length,
    });

    toast.success(i18n.t('common.success'));
  } catch (err) {
    console.error(err);
    toast.error(i18n.t('common.error'));
  } finally {
    btn.disabled = false;
    btnText.textContent = originalText;
  }
}

export function destroy() {
  stopCamera();
}
