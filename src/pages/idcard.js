// ============================================
// ScanPro — ID Card Scanner Module (Premium)
// ============================================

import { jsPDF } from 'jspdf';
import i18n from '../i18n.js';
import toast from '../toast.js';
import store from '../store.js';
import {
  readFileAsDataURL, compressImage, loadImage, downloadBlob,
  applyFilter, uid, dataURLtoBlob, createZipBlob,
  applyBrightnessContrast, applyEraserBlur, addWatermarkToCanvas
} from '../utils.js';

// ---- State ----
let currentStep = 1;
let selectedIdType = 'aadhaar';
let scanMode = 'double'; // 'single' | 'double'
let frontImage = null;  // original data URL
let backImage = null;
let frontEdited = null; // edited data URL
let backEdited = null;
let currentEditSide = 'front';
let activeTool = 'filters';
let activeFilter = 'original';
let cameraStream = null;
let capturingSide = 'front';
let brightness = 0;
let contrast = 0;
let eraserPoints = [];
let eraserRadius = 20;
let watermarkText = '';
let undoStack = [];
let redoStack = [];

// A4 canvas card positions (percentages of container)
let cardPositions = {
  front: { x: 10, y: 5, w: 80, h: 42 },
  back: { x: 10, y: 52, w: 80, h: 42 }
};
let selectedCard = null;
let dragState = null;
let exportFormat = 'pdf';
let exportPageSize = 'a4';
let exportQuality = 85;

const ID_TYPES = [
  { key: 'aadhaar', icon: '🪪', defaultMode: 'double' },
  { key: 'pan', icon: '💳', defaultMode: 'single' },
  { key: 'voter', icon: '🗳️', defaultMode: 'double' },
  { key: 'dl', icon: '🚗', defaultMode: 'double' },
  { key: 'passport', icon: '🛂', defaultMode: 'double' },
  { key: 'custom', icon: '📄', defaultMode: 'double' },
];

const FILTERS = [
  { key: 'original', css: 'none' },
  { key: 'vibrant', css: 'saturate(1.4) contrast(1.1)' },
  { key: 'softTone', css: 'brightness(1.05) saturate(0.9) sepia(0.1)' },
  { key: 'sharpBW', css: 'grayscale(1) contrast(1.4)' },
  { key: 'enhance', css: 'contrast(1.15) brightness(1.05) saturate(1.1)' },
  { key: 'document', css: 'grayscale(0.3) contrast(1.3) brightness(1.1)' },
];

const t = (key) => i18n.t(key);

// ---- SVG Icons ----
const ICONS = {
  filters: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  crop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>',
  rotate: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  eraser: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
  watermark: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  brightness: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  camera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  upload: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  undo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  redo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
};

// =============================================
// RENDER
// =============================================
export function render() {
  return `
    <div class="idcard-container animate-fade-in-up">
      <div class="page-header">
        <h1>${t('idcard.title')}</h1>
        <p>${t('idcard.subtitle')}</p>
      </div>
      ${renderStepIndicator()}
      <div id="id-step-content">
        ${renderCurrentStep()}
      </div>
    </div>
  `;
}

function renderStepIndicator() {
  const steps = [
    t('idcard.step1'), t('idcard.step2'),
    t('idcard.step3'), t('idcard.step4')
  ];
  let dots = '';
  for (let i = 1; i <= 4; i++) {
    const cls = i === currentStep ? 'active' : (i < currentStep ? 'completed' : '');
    dots += `<div class="id-step-dot ${cls}" data-step="${i}"></div>`;
    if (i < 4) {
      dots += `<div class="id-step-line ${i < currentStep ? 'completed' : ''}"></div>`;
    }
  }
  let labels = steps.map((s, i) =>
    `<span class="id-step-label ${i + 1 === currentStep ? 'active' : ''}">${s}</span>`
  ).join('');

  return `
    <div class="id-step-bar">${dots}</div>
    <div class="id-step-labels">${labels}</div>
  `;
}

function renderCurrentStep() {
  switch (currentStep) {
    case 1: return renderStep1();
    case 2: return renderStep2();
    case 3: return renderStep3();
    case 4: return renderStep4();
    default: return '';
  }
}

// ---- Step 1: ID Type Selection ----
function renderStep1() {
  const cards = ID_TYPES.map(id => `
    <div class="id-type-card ${selectedIdType === id.key ? 'selected' : ''}" data-idtype="${id.key}">
      <span class="id-check">${ICONS.check}</span>
      <span class="id-icon">${id.icon}</span>
      <span class="id-name">${t('idcard.' + id.key)}</span>
    </div>
  `).join('');

  return `
    <div class="animate-fade-in-up" style="display:flex;flex-direction:column;gap:var(--space-6)">
      <h3 class="text-lg font-semibold">${t('idcard.selectType')}</h3>
      <div class="id-types-grid">${cards}</div>

      <h3 class="text-lg font-semibold">${t('idcard.scanMode')}</h3>
      <div class="id-scan-mode">
        <button class="id-scan-mode-btn ${scanMode === 'single' ? 'active' : ''}" data-mode="single">
          ${t('idcard.singleSide')}
        </button>
        <button class="id-scan-mode-btn ${scanMode === 'double' ? 'active' : ''}" data-mode="double">
          ${t('idcard.doubleSide')}
        </button>
      </div>

      <div class="id-actions">
        <button class="btn btn-primary btn-lg btn-block" id="id-step1-next">
          ${t('idcard.continue')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ---- Step 2: Capture / Upload ----
function renderStep2() {
  const showBack = scanMode === 'double';
  const frontCaptured = !!frontImage;
  const backCaptured = !!backImage;
  const currentSide = !frontCaptured ? 'front' : (showBack && !backCaptured ? 'back' : 'done');

  return `
    <div class="id-capture-container animate-fade-in-up">
      ${showBack ? `
        <div class="id-side-indicator">
          <div class="id-side">
            <div class="id-side-box ${currentSide === 'front' ? 'active' : ''} ${frontCaptured ? 'captured' : ''}">
              ${frontImage ? `<img src="${frontImage}" alt="Front"/>` : `<span class="side-placeholder">${t('idcard.front')}</span>`}
            </div>
            <span class="id-side-label">${t('idcard.front')}</span>
          </div>
          <div class="id-side">
            <div class="id-side-box ${currentSide === 'back' ? 'active' : ''} ${backCaptured ? 'captured' : ''}">
              ${backImage ? `<img src="${backImage}" alt="Back"/>` : `<span class="side-placeholder">${t('idcard.back')}</span>`}
            </div>
            <span class="id-side-label">${t('idcard.back')}</span>
          </div>
        </div>
      ` : ''}

      ${currentSide !== 'done' ? `
        <h3 class="text-lg font-semibold" style="text-align:center">
          ${currentSide === 'front' ? t('idcard.captureFront') : t('idcard.captureBack')}
        </h3>

        <!-- Camera view -->
        <div class="id-camera-container" id="id-camera-container" style="display:none">
          <video id="id-camera-video" autoplay playsinline></video>
          <div class="id-camera-guide">
            <div class="id-camera-guide-corners"></div>
          </div>
          <div class="id-camera-hint">${t('idcard.alignCard')}</div>
          <div class="camera-controls" id="id-camera-controls">
            <button class="camera-switch-btn" id="id-camera-stop" title="Cancel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button class="capture-btn" id="id-capture-btn"></button>
            <button class="camera-switch-btn" id="id-camera-switch">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>
          <canvas id="id-camera-canvas" style="display:none"></canvas>
        </div>

        <!-- Capture options -->
        <div class="id-capture-options">
          <button class="btn btn-secondary btn-lg" id="id-open-camera">
            ${ICONS.camera}
            <span>${t('idcard.camera')}</span>
          </button>
          <button class="btn btn-primary btn-lg" id="id-open-gallery">
            ${ICONS.upload}
            <span>${t('idcard.gallery')}</span>
          </button>
        </div>
        <input type="file" id="id-file-input" accept="image/*" style="display:none" />
      ` : `
        <div style="text-align:center;padding:var(--space-4)">
          <div style="font-size:3rem;margin-bottom:var(--space-4)">✅</div>
          <h3 class="text-lg font-semibold mb-4">${t('idcard.captureComplete')}</h3>
        </div>
      `}

      <div class="id-actions">
        <button class="btn btn-secondary" id="id-step2-back">
          ${ICONS.back} ${t('common.back')}
        </button>
        ${(currentSide === 'done' || (scanMode === 'single' && frontCaptured)) ? `
          <button class="btn btn-primary" id="id-step2-next">
            ${t('common.next')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// ---- Step 3: Edit & Arrange ----
function renderStep3() {
  const editImage = currentEditSide === 'front'
    ? (frontEdited || frontImage)
    : (backEdited || backImage);
  const showBack = scanMode === 'double' && backImage;

  return `
    <div class="id-editor-view animate-fade-in-up">
      <!-- Side thumbnails -->
      ${showBack ? `
        <div class="id-side-thumbs">
          <div class="id-side-thumb ${currentEditSide === 'front' ? 'active' : ''}" data-editside="front">
            <img src="${frontEdited || frontImage}" alt="Front" />
            <span class="id-side-thumb-label">${t('idcard.front')}</span>
          </div>
          <div class="id-side-thumb ${currentEditSide === 'back' ? 'active' : ''}" data-editside="back">
            <img src="${backEdited || backImage}" alt="Back" />
            <span class="id-side-thumb-label">${t('idcard.back')}</span>
          </div>
        </div>
      ` : ''}

      <!-- Editor canvas -->
      <div class="id-editor-canvas-wrap" id="id-editor-wrap">
        <canvas id="id-editor-canvas"></canvas>
      </div>

      <!-- Tool panel (shown based on active tool) -->
      <div id="id-tool-panel-area"></div>

      <!-- Filter carousel (shown when filters tool active) -->
      <div id="id-filter-area">
        ${activeTool === 'filters' ? renderFilterCarousel() : ''}
      </div>

      <!-- Toolbar -->
      <div class="id-editor-toolbar">
        ${renderToolbar()}
      </div>

      <!-- Actions -->
      <div class="id-actions">
        <button class="btn btn-secondary" id="id-step3-back">
          ${ICONS.back} ${t('common.back')}
        </button>
        <button class="btn btn-ghost" id="id-undo" title="${t('idcard.edit.undo')}">
          ${ICONS.undo}
        </button>
        <button class="btn btn-ghost" id="id-redo" title="${t('idcard.edit.redo')}">
          ${ICONS.redo}
        </button>
        <button class="btn btn-primary" id="id-step3-next">
          ${t('common.next')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderToolbar() {
  const tools = [
    { key: 'filters', icon: ICONS.filters, label: t('idcard.edit.filters') },
    { key: 'crop', icon: ICONS.crop, label: t('idcard.edit.crop') },
    { key: 'rotate', icon: ICONS.rotate, label: t('idcard.edit.rotate') },
    { key: 'eraser', icon: ICONS.eraser, label: t('idcard.edit.eraser') },
    { key: 'watermark', icon: ICONS.watermark, label: t('idcard.edit.watermark') },
    { key: 'brightness', icon: ICONS.brightness, label: t('idcard.edit.brightness') },
  ];
  return tools.map(tool => `
    <button class="id-tool-btn ${activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}">
      ${tool.icon}
      <span>${tool.label}</span>
    </button>
  `).join('');
}

function renderFilterCarousel() {
  return `
    <div class="id-filter-carousel">
      ${FILTERS.map(f => `
        <div class="id-filter-item ${activeFilter === f.key ? 'active' : ''}" data-filter="${f.key}">
          <div class="id-filter-preview">
            <img id="id-filter-thumb-${f.key}" src="" alt="${f.key}" style="filter: ${f.css}" />
          </div>
          <span class="id-filter-name">${t('idcard.filter.' + f.key)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- Step 4: Preview & Export ----
function renderStep4() {
  const showBack = scanMode === 'double' && (backEdited || backImage);
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '');
  const autoName = `${selectedIdType.charAt(0).toUpperCase() + selectedIdType.slice(1)}${showBack ? '_Front_Back' : ''}_${dateStr}`;

  return `
    <div class="id-export-container animate-fade-in-up">
      <!-- A4 Preview with drag/resize -->
      <h3 class="text-lg font-semibold">${t('idcard.arrange')}</h3>
      <p class="text-xs text-secondary">${t('idcard.arrange.hint')}</p>

      ${showBack ? `
        <div class="id-layout-presets">
          <button class="id-layout-btn" data-layout="vertical">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="8" rx="1"/><rect x="4" y="14" width="16" height="8" rx="1"/></svg>
            ${t('idcard.arrange.vertical')}
          </button>
          <button class="id-layout-btn" data-layout="horizontal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/></svg>
            ${t('idcard.arrange.horizontal')}
          </button>
          <button class="id-layout-btn" data-layout="fill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            ${t('idcard.arrange.fill')}
          </button>
        </div>
      ` : ''}

      <div class="id-a4-container">
        <div class="id-a4-dims">${exportPageSize === 'a4' ? '210 × 297 mm (A4)' : '8.5 × 11 in (Letter)'}</div>
        <div class="id-a4-wrapper ${exportPageSize === 'letter' ? 'letter' : ''}" id="id-a4-wrapper">
          <!-- Snap guides -->
          <div class="id-snap-line horizontal" id="id-snap-h" style="top:50%"></div>
          <div class="id-snap-line vertical" id="id-snap-v" style="left:50%"></div>

          <!-- Front card -->
          <div class="id-a4-card" id="id-a4-front" style="left:${cardPositions.front.x}%;top:${cardPositions.front.y}%;width:${cardPositions.front.w}%;height:${cardPositions.front.h}%">
            <img src="${frontEdited || frontImage}" alt="Front" />
            <div class="id-resize-handle tl" data-handle="tl"></div>
            <div class="id-resize-handle tr" data-handle="tr"></div>
            <div class="id-resize-handle bl" data-handle="bl"></div>
            <div class="id-resize-handle br" data-handle="br"></div>
          </div>

          ${showBack ? `
            <div class="id-a4-card" id="id-a4-back" style="left:${cardPositions.back.x}%;top:${cardPositions.back.y}%;width:${cardPositions.back.w}%;height:${cardPositions.back.h}%">
              <img src="${backEdited || backImage}" alt="Back" />
              <div class="id-resize-handle tl" data-handle="tl"></div>
              <div class="id-resize-handle tr" data-handle="tr"></div>
              <div class="id-resize-handle bl" data-handle="bl"></div>
              <div class="id-resize-handle br" data-handle="br"></div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Export format -->
      <h3 class="text-lg font-semibold">${t('idcard.exportAs')}</h3>
      <div class="id-export-formats">
        <div class="id-export-card ${exportFormat === 'pdf' ? 'selected' : ''}" data-format="pdf">
          <span class="export-icon">📄</span>
          <span class="export-label">${t('idcard.export.pdf')}</span>
        </div>
        <div class="id-export-card ${exportFormat === 'jpg' ? 'selected' : ''}" data-format="jpg">
          <span class="export-icon">🖼️</span>
          <span class="export-label">${t('idcard.export.image')}</span>
        </div>
        <div class="id-export-card ${exportFormat === 'png' ? 'selected' : ''}" data-format="png">
          <span class="export-icon">🎨</span>
          <span class="export-label">${t('idcard.export.png')}</span>
        </div>
        ${(scanMode === 'double' && backImage) ? `
          <div class="id-export-card ${exportFormat === 'zip' ? 'selected' : ''}" data-format="zip">
            <span class="export-icon">📦</span>
            <span class="export-label">${t('idcard.export.zip')}</span>
          </div>
        ` : ''}
      </div>

      <!-- Export settings -->
      <div class="id-export-settings">
        <div class="input-group">
          <label>${t('idcard.export.pageSize')}</label>
          <select class="select" id="id-export-pagesize">
            <option value="a4" ${exportPageSize === 'a4' ? 'selected' : ''}>A4 (210 × 297 mm)</option>
            <option value="letter" ${exportPageSize === 'letter' ? 'selected' : ''}>Letter (8.5 × 11 in)</option>
          </select>
        </div>
        <div class="input-group">
          <label>${t('idcard.export.quality')}</label>
          <input type="range" class="range-slider" id="id-export-quality" min="50" max="100" value="${exportQuality}" />
          <span class="text-xs text-secondary" id="id-quality-label">${exportQuality}%</span>
        </div>
        <div class="input-group">
          <label>${t('idcard.export.fileName')}</label>
          <input type="text" class="input" id="id-export-filename" value="${autoName}" />
        </div>
      </div>

      <!-- Actions -->
      <div class="id-actions">
        <button class="btn btn-secondary" id="id-step4-back">
          ${ICONS.back} ${t('common.back')}
        </button>
        <button class="btn btn-primary btn-lg" id="id-export-btn" style="flex:2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span id="id-export-text">${t('idcard.export')}</span>
        </button>
      </div>

      <!-- Start over -->
      <button class="btn btn-ghost btn-block" id="id-start-over" style="margin-top:var(--space-2)">
        ${t('idcard.reset')}
      </button>
    </div>
  `;
}

// =============================================
// INIT
// =============================================
export function init() {
  setupStepNavigation();
  initCurrentStep();
}

function refreshUI() {
  const container = document.getElementById('page-content');
  if (!container) return;
  container.innerHTML = render();
  requestAnimationFrame(() => init());
}

function goToStep(step) {
  currentStep = step;
  refreshUI();
}

function setupStepNavigation() {
  // Step dots
  document.querySelectorAll('.id-step-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const step = parseInt(dot.dataset.step);
      if (step < currentStep) goToStep(step);
    });
  });
}

function initCurrentStep() {
  switch (currentStep) {
    case 1: initStep1(); break;
    case 2: initStep2(); break;
    case 3: initStep3(); break;
    case 4: initStep4(); break;
  }
}

// ---- Step 1 Init ----
function initStep1() {
  // ID type selection
  document.querySelectorAll('.id-type-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedIdType = card.dataset.idtype;
      const idDef = ID_TYPES.find(t => t.key === selectedIdType);
      if (idDef) scanMode = idDef.defaultMode;
      refreshUI();
    });
  });

  // Scan mode toggle
  document.querySelectorAll('.id-scan-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scanMode = btn.dataset.mode;
      document.querySelectorAll('.id-scan-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Next button
  document.getElementById('id-step1-next')?.addEventListener('click', () => {
    goToStep(2);
  });
}

// ---- Step 2 Init ----
let facingMode = 'environment';

function initStep2() {
  const openCamera = document.getElementById('id-open-camera');
  const openGallery = document.getElementById('id-open-gallery');
  const fileInput = document.getElementById('id-file-input');
  const captureBtn = document.getElementById('id-capture-btn');
  const switchBtn = document.getElementById('id-camera-switch');
  const stopBtn = document.getElementById('id-camera-stop');

  openCamera?.addEventListener('click', startIdCamera);
  openGallery?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      assignCapture(dataUrl);
    } catch (err) {
      toast.error(t('common.error'));
    }
    fileInput.value = '';
  });

  captureBtn?.addEventListener('click', captureIdPhoto);
  switchBtn?.addEventListener('click', switchIdCamera);
  stopBtn?.addEventListener('click', stopIdCamera);

  document.getElementById('id-step2-back')?.addEventListener('click', () => {
    stopIdCamera();
    goToStep(1);
  });

  document.getElementById('id-step2-next')?.addEventListener('click', () => {
    stopIdCamera();
    // Initialize edited versions
    if (frontImage && !frontEdited) frontEdited = frontImage;
    if (backImage && !backEdited) backEdited = backImage;
    goToStep(3);
  });
}

async function startIdCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    const video = document.getElementById('id-camera-video');
    if (video) {
      video.srcObject = cameraStream;
      document.getElementById('id-camera-container').style.display = 'block';
    }
  } catch (err) {
    toast.error(t('scanner.camera.error'));
  }
}

function stopIdCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const container = document.getElementById('id-camera-container');
  if (container) container.style.display = 'none';
}

async function switchIdCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  stopIdCamera();
  await startIdCamera();
}

function captureIdPhoto() {
  const video = document.getElementById('id-camera-video');
  const canvas = document.getElementById('id-camera-canvas');
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // Flash effect
  const btn = document.getElementById('id-capture-btn');
  if (btn) {
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 300);
  }

  // Vibrate
  if (navigator.vibrate) navigator.vibrate(50);

  stopIdCamera();
  assignCapture(dataUrl);
}

function assignCapture(dataUrl) {
  if (!frontImage) {
    frontImage = dataUrl;
    toast.success(t('idcard.front') + ' ✓');
  } else if (scanMode === 'double' && !backImage) {
    backImage = dataUrl;
    toast.success(t('idcard.back') + ' ✓');
  }
  refreshUI();
}

// ---- Step 3 Init ----
function initStep3() {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;

  // Load current side image
  const imgSrc = currentEditSide === 'front'
    ? (frontEdited || frontImage)
    : (backEdited || backImage);

  if (imgSrc) {
    drawImageToCanvas(canvas, imgSrc);
  }

  // Side thumb switching
  document.querySelectorAll('.id-side-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      // Save current edit
      saveCurrentEdit();
      currentEditSide = thumb.dataset.editside;
      refreshUI();
    });
  });

  // Tool selection
  document.querySelectorAll('.id-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTool = btn.dataset.tool;
      updateToolUI();
    });
  });

  // Filter selection
  setupFilterListeners();

  // Undo/Redo
  document.getElementById('id-undo')?.addEventListener('click', undo);
  document.getElementById('id-redo')?.addEventListener('click', redo);

  // Navigation
  document.getElementById('id-step3-back')?.addEventListener('click', () => {
    saveCurrentEdit();
    goToStep(2);
  });

  document.getElementById('id-step3-next')?.addEventListener('click', () => {
    saveCurrentEdit();
    // Reset card positions based on content
    resetCardPositions();
    goToStep(4);
  });

  // Init active tool panel
  updateToolUI();
}

async function drawImageToCanvas(canvas, src) {
  const img = await loadImage(src);
  const maxW = canvas.parentElement?.clientWidth || 400;
  const maxH = 450;
  let w = img.width, h = img.height;

  if (w > maxW) { h = (h * maxW) / w; w = maxW; }
  if (h > maxH) { w = (w * maxH) / h; h = maxH; }

  canvas.width = img.width;
  canvas.height = img.height;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
}

function saveCurrentEdit() {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas || canvas.width === 0) return;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  if (currentEditSide === 'front') frontEdited = dataUrl;
  else backEdited = dataUrl;
}

function pushUndo() {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;
  undoStack.push(canvas.toDataURL('image/png'));
  if (undoStack.length > 20) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (undoStack.length === 0) return;
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;
  redoStack.push(canvas.toDataURL('image/png'));
  const prev = undoStack.pop();
  drawImageToCanvas(canvas, prev);
}

function redo() {
  if (redoStack.length === 0) return;
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;
  undoStack.push(canvas.toDataURL('image/png'));
  const next = redoStack.pop();
  drawImageToCanvas(canvas, next);
}

function updateToolUI() {
  // Update toolbar active state
  document.querySelectorAll('.id-tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === activeTool);
  });

  // Update filter area
  const filterArea = document.getElementById('id-filter-area');
  if (filterArea) {
    filterArea.innerHTML = activeTool === 'filters' ? renderFilterCarousel() : '';
    if (activeTool === 'filters') setupFilterListeners();
  }

  // Update tool panel
  const panelArea = document.getElementById('id-tool-panel-area');
  if (panelArea) {
    panelArea.innerHTML = renderToolPanel();
    setupToolPanelListeners();
  }
}

function renderToolPanel() {
  switch (activeTool) {
    case 'brightness':
      return `
        <div class="id-tool-panel">
          <div class="input-group">
            <label>${t('idcard.edit.brightness')}</label>
            <div class="slider-row">
              <input type="range" class="range-slider" id="id-brightness" min="-100" max="100" value="${brightness}" />
              <span class="slider-value" id="id-brightness-val">${brightness}</span>
            </div>
          </div>
          <div class="input-group">
            <label>${t('idcard.edit.contrast')}</label>
            <div class="slider-row">
              <input type="range" class="range-slider" id="id-contrast" min="-100" max="100" value="${contrast}" />
              <span class="slider-value" id="id-contrast-val">${contrast}</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm btn-block" id="id-apply-bc" style="margin-top:var(--space-3)">
            ${t('editor.apply')}
          </button>
        </div>
      `;
    case 'eraser':
      return `
        <div class="id-tool-panel">
          <div class="input-group">
            <label>${t('idcard.eraser.size')}</label>
            <div class="slider-row">
              <input type="range" class="range-slider" id="id-eraser-size" min="10" max="60" value="${eraserRadius}" />
              <span class="slider-value" id="id-eraser-val">${eraserRadius}px</span>
            </div>
          </div>
          <p class="text-xs text-secondary">${t('idcard.privacyBlur')} — draw on the image to blur</p>
        </div>
      `;
    case 'watermark':
      return `
        <div class="id-tool-panel">
          <div class="input-group">
            <label>${t('idcard.edit.watermark')}</label>
            <input type="text" class="input" id="id-watermark-text" value="${watermarkText}"
              placeholder="${t('idcard.watermark.placeholder')}" />
          </div>
          <button class="btn btn-primary btn-sm btn-block" id="id-apply-watermark" style="margin-top:var(--space-3)">
            ${t('editor.apply')}
          </button>
        </div>
      `;
    case 'crop':
      return `
        <div class="id-tool-panel">
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-3)">Click and drag on the image to crop</p>
          <button class="btn btn-primary btn-sm btn-block" id="id-apply-crop">
            ${t('idcard.edit.crop')} — Apply
          </button>
        </div>
      `;
    case 'rotate':
      return `
        <div class="id-tool-panel">
          <div style="display:flex;gap:var(--space-3)">
            <button class="btn btn-secondary btn-block" id="id-rotate-left">↺ 90° Left</button>
            <button class="btn btn-secondary btn-block" id="id-rotate-right">↻ 90° Right</button>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

function setupFilterListeners() {
  // Set filter thumbnails
  const src = currentEditSide === 'front'
    ? (frontEdited || frontImage)
    : (backEdited || backImage);

  document.querySelectorAll('.id-filter-item img').forEach(img => {
    if (src) img.src = src;
  });

  document.querySelectorAll('.id-filter-item').forEach(item => {
    item.addEventListener('click', () => {
      const filterKey = item.dataset.filter;
      activeFilter = filterKey;
      applyFilterToCanvas(filterKey);
      document.querySelectorAll('.id-filter-item').forEach(f => f.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

async function applyFilterToCanvas(filterKey) {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;

  pushUndo();

  const src = currentEditSide === 'front' ? (frontImage) : (backImage);
  const img = await loadImage(src);

  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  const filter = FILTERS.find(f => f.key === filterKey);
  ctx.filter = filter ? filter.css : 'none';
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';
}

function setupToolPanelListeners() {
  // Brightness/Contrast
  const brSlider = document.getElementById('id-brightness');
  const ctSlider = document.getElementById('id-contrast');

  brSlider?.addEventListener('input', (e) => {
    brightness = parseInt(e.target.value);
    const label = document.getElementById('id-brightness-val');
    if (label) label.textContent = brightness;
  });

  ctSlider?.addEventListener('input', (e) => {
    contrast = parseInt(e.target.value);
    const label = document.getElementById('id-contrast-val');
    if (label) label.textContent = contrast;
  });

  document.getElementById('id-apply-bc')?.addEventListener('click', async () => {
    const canvas = document.getElementById('id-editor-canvas');
    if (!canvas) return;
    pushUndo();
    applyBrightnessContrast(canvas, brightness, contrast);
    brightness = 0;
    contrast = 0;
    toast.success(t('common.success'));
  });

  // Eraser
  const eraserSize = document.getElementById('id-eraser-size');
  eraserSize?.addEventListener('input', (e) => {
    eraserRadius = parseInt(e.target.value);
    const label = document.getElementById('id-eraser-val');
    if (label) label.textContent = eraserRadius + 'px';
  });

  if (activeTool === 'eraser') {
    setupEraserDrawing();
  }

  // Watermark
  document.getElementById('id-apply-watermark')?.addEventListener('click', () => {
    const input = document.getElementById('id-watermark-text');
    watermarkText = input?.value || '';
    if (!watermarkText) return;
    const canvas = document.getElementById('id-editor-canvas');
    if (!canvas) return;
    pushUndo();
    addWatermarkToCanvas(canvas, watermarkText, {
      fontSize: Math.max(16, canvas.width / 15),
      color: 'rgba(0, 0, 0, 0.12)',
      rotation: -25,
      position: 'tiled'
    });
    toast.success(t('common.success'));
  });

  // Rotate
  document.getElementById('id-rotate-left')?.addEventListener('click', () => rotateCanvas(-90));
  document.getElementById('id-rotate-right')?.addEventListener('click', () => rotateCanvas(90));

  // Crop
  if (activeTool === 'crop') {
    setupCropTool();
  }
}

function setupEraserDrawing() {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;

  let isDrawing = false;
  let points = [];

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const onStart = (e) => {
    e.preventDefault();
    isDrawing = true;
    pushUndo();
    points = [getPos(e)];
  };

  const onMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    points.push(pos);
    applyEraserBlur(canvas, [pos], eraserRadius * (canvas.width / canvas.getBoundingClientRect().width));
  };

  const onEnd = () => {
    isDrawing = false;
    points = [];
  };

  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);
}

let cropState = null;

function setupCropTool() {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;

  cropState = { startX: 0, startY: 0, endX: 0, endY: 0, active: false };

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const drawCropOverlay = () => {
    if (!cropState.active) return;
    const ctx = canvas.getContext('2d');
    // Re-draw from original first — we need the temp image
    const x1 = Math.min(cropState.startX, cropState.endX);
    const y1 = Math.min(cropState.startY, cropState.endY);
    const x2 = Math.max(cropState.startX, cropState.endX);
    const y2 = Math.max(cropState.startY, cropState.endY);

    // Dim outside crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, y1);
    ctx.fillRect(0, y2, canvas.width, canvas.height - y2);
    ctx.fillRect(0, y1, x1, y2 - y1);
    ctx.fillRect(x2, y1, canvas.width - x2, y2 - y1);

    // Crop border
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.setLineDash([]);
  };

  let tempImageData = null;

  canvas.addEventListener('mousedown', (e) => {
    if (activeTool !== 'crop') return;
    const pos = getPos(e);
    cropState.startX = pos.x;
    cropState.startY = pos.y;
    cropState.active = true;
    tempImageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!cropState.active || activeTool !== 'crop') return;
    const pos = getPos(e);
    cropState.endX = pos.x;
    cropState.endY = pos.y;
    if (tempImageData) {
      canvas.getContext('2d').putImageData(tempImageData, 0, 0);
    }
    drawCropOverlay();
  });

  canvas.addEventListener('mouseup', () => {
    if (activeTool !== 'crop') return;
    cropState.active = false;
  });

  document.getElementById('id-apply-crop')?.addEventListener('click', () => {
    if (!cropState || (cropState.startX === cropState.endX)) return;
    pushUndo();

    const x1 = Math.min(cropState.startX, cropState.endX);
    const y1 = Math.min(cropState.startY, cropState.endY);
    const cw = Math.abs(cropState.endX - cropState.startX);
    const ch = Math.abs(cropState.endY - cropState.startY);

    if (cw < 10 || ch < 10) return;

    if (tempImageData) {
      canvas.getContext('2d').putImageData(tempImageData, 0, 0);
    }

    const imgData = canvas.getContext('2d').getImageData(x1, y1, cw, ch);
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext('2d').putImageData(imgData, 0, 0);

    cropState = null;
    tempImageData = null;
    toast.success(t('common.success'));
  });
}

async function rotateCanvas(degrees) {
  const canvas = document.getElementById('id-editor-canvas');
  if (!canvas) return;

  pushUndo();

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  if (Math.abs(degrees) === 90) {
    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((degrees * Math.PI) / 180);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  } else {
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((degrees * Math.PI) / 180);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  }

  canvas.width = tempCanvas.width;
  canvas.height = tempCanvas.height;
  canvas.getContext('2d').drawImage(tempCanvas, 0, 0);

  toast.success(t('common.success'));
}

function resetCardPositions() {
  if (scanMode === 'single' || !backImage) {
    cardPositions.front = { x: 10, y: 15, w: 80, h: 70 };
  } else {
    cardPositions.front = { x: 10, y: 5, w: 80, h: 42 };
    cardPositions.back = { x: 10, y: 52, w: 80, h: 42 };
  }
}

// ---- Step 4 Init ----
function initStep4() {
  // Export format
  document.querySelectorAll('.id-export-card').forEach(card => {
    card.addEventListener('click', () => {
      exportFormat = card.dataset.format;
      document.querySelectorAll('.id-export-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  // Page size
  document.getElementById('id-export-pagesize')?.addEventListener('change', (e) => {
    exportPageSize = e.target.value;
    const wrapper = document.getElementById('id-a4-wrapper');
    if (wrapper) {
      wrapper.classList.toggle('letter', exportPageSize === 'letter');
    }
    const dims = document.querySelector('.id-a4-dims');
    if (dims) dims.textContent = exportPageSize === 'a4' ? '210 × 297 mm (A4)' : '8.5 × 11 in (Letter)';
  });

  // Quality slider
  const qualitySlider = document.getElementById('id-export-quality');
  qualitySlider?.addEventListener('input', (e) => {
    exportQuality = parseInt(e.target.value);
    const label = document.getElementById('id-quality-label');
    if (label) label.textContent = exportQuality + '%';
  });

  // Layout presets
  document.querySelectorAll('.id-layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLayout(btn.dataset.layout);
    });
  });

  // Drag & resize on A4
  setupA4DragResize();

  // Export
  document.getElementById('id-export-btn')?.addEventListener('click', doExport);

  // Start over
  document.getElementById('id-start-over')?.addEventListener('click', resetAll);

  // Back
  document.getElementById('id-step4-back')?.addEventListener('click', () => goToStep(3));
}

function applyLayout(layout) {
  switch (layout) {
    case 'vertical':
      cardPositions.front = { x: 10, y: 5, w: 80, h: 42 };
      cardPositions.back = { x: 10, y: 52, w: 80, h: 42 };
      break;
    case 'horizontal':
      cardPositions.front = { x: 3, y: 25, w: 45, h: 50 };
      cardPositions.back = { x: 52, y: 25, w: 45, h: 50 };
      break;
    case 'fill':
      cardPositions.front = { x: 5, y: 3, w: 90, h: 45 };
      cardPositions.back = { x: 5, y: 52, w: 90, h: 45 };
      break;
  }
  refreshA4Cards();
}

function refreshA4Cards() {
  const frontEl = document.getElementById('id-a4-front');
  const backEl = document.getElementById('id-a4-back');

  if (frontEl) {
    frontEl.style.left = cardPositions.front.x + '%';
    frontEl.style.top = cardPositions.front.y + '%';
    frontEl.style.width = cardPositions.front.w + '%';
    frontEl.style.height = cardPositions.front.h + '%';
  }
  if (backEl) {
    backEl.style.left = cardPositions.back.x + '%';
    backEl.style.top = cardPositions.back.y + '%';
    backEl.style.width = cardPositions.back.w + '%';
    backEl.style.height = cardPositions.back.h + '%';
  }
}

function setupA4DragResize() {
  const wrapper = document.getElementById('id-a4-wrapper');
  if (!wrapper) return;

  let isDragging = false;
  let isResizing = false;
  let activeHandle = '';
  let startX, startY, startPos;
  let currentCardEl = null;
  let currentCardKey = null;

  const getCardKey = (el) => {
    if (el.id === 'id-a4-front') return 'front';
    if (el.id === 'id-a4-back') return 'back';
    return null;
  };

  const toPercent = (px, total) => (px / total) * 100;

  const onPointerDown = (e) => {
    const handle = e.target.closest('.id-resize-handle');
    const card = e.target.closest('.id-a4-card');
    if (!card) {
      // Deselect
      document.querySelectorAll('.id-a4-card').forEach(c => c.classList.remove('selected'));
      selectedCard = null;
      return;
    }

    e.preventDefault();
    currentCardEl = card;
    currentCardKey = getCardKey(card);

    // Select card
    document.querySelectorAll('.id-a4-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedCard = currentCardKey;

    const rect = wrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    startPos = { ...cardPositions[currentCardKey] };

    if (handle) {
      isResizing = true;
      activeHandle = handle.dataset.handle;
    } else {
      isDragging = true;
    }
  };

  const onPointerMove = (e) => {
    if (!isDragging && !isResizing) return;
    e.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = toPercent(clientX - startX, rect.width);
    const dy = toPercent(clientY - startY, rect.height);

    if (isDragging && currentCardKey) {
      const newX = Math.max(0, Math.min(100 - startPos.w, startPos.x + dx));
      const newY = Math.max(0, Math.min(100 - startPos.h, startPos.y + dy));
      cardPositions[currentCardKey].x = newX;
      cardPositions[currentCardKey].y = newY;

      // Snap guides
      showSnapGuides(newX, newY, cardPositions[currentCardKey].w, cardPositions[currentCardKey].h);
    }

    if (isResizing && currentCardKey) {
      let { x, y, w, h } = startPos;
      const minSize = 15;

      if (activeHandle.includes('r')) w = Math.max(minSize, w + dx);
      if (activeHandle.includes('l')) { x = x + dx; w = Math.max(minSize, w - dx); }
      if (activeHandle.includes('b')) h = Math.max(minSize, h + dy);
      if (activeHandle.includes('t')) { y = y + dy; h = Math.max(minSize, h - dy); }

      cardPositions[currentCardKey] = {
        x: Math.max(0, x),
        y: Math.max(0, y),
        w: Math.min(100, w),
        h: Math.min(100, h)
      };
    }

    refreshA4Cards();
  };

  const onPointerUp = () => {
    isDragging = false;
    isResizing = false;
    hideSnapGuides();
  };

  wrapper.addEventListener('mousedown', onPointerDown);
  wrapper.addEventListener('touchstart', onPointerDown, { passive: false });
  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('mouseup', onPointerUp);
  document.addEventListener('touchend', onPointerUp);
}

function showSnapGuides(x, y, w, h) {
  const snapH = document.getElementById('id-snap-h');
  const snapV = document.getElementById('id-snap-v');
  if (!snapH || !snapV) return;

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Snap to center
  if (Math.abs(cx - 50) < 3) {
    snapV.classList.add('visible');
    snapV.style.left = '50%';
  } else {
    snapV.classList.remove('visible');
  }

  if (Math.abs(cy - 50) < 3) {
    snapH.classList.add('visible');
    snapH.style.top = '50%';
  } else {
    snapH.classList.remove('visible');
  }
}

function hideSnapGuides() {
  document.getElementById('id-snap-h')?.classList.remove('visible');
  document.getElementById('id-snap-v')?.classList.remove('visible');
}

// ---- Export ----
async function doExport() {
  const btn = document.getElementById('id-export-btn');
  const btnText = document.getElementById('id-export-text');
  const originalText = btnText?.textContent;
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = t('idcard.export.exporting');

  const fileName = document.getElementById('id-export-filename')?.value || 'IDCard';
  const quality = exportQuality / 100;

  try {
    const frontSrc = frontEdited || frontImage;
    const backSrc = backEdited || backImage;

    if (exportFormat === 'pdf') {
      await exportAsPDF(frontSrc, backSrc, fileName, quality);
    } else if (exportFormat === 'jpg' || exportFormat === 'png') {
      await exportAsImage(frontSrc, backSrc, fileName, exportFormat, quality);
    } else if (exportFormat === 'zip') {
      await exportAsZip(frontSrc, backSrc, fileName);
    }

    // Save to history
    await store.addHistory({
      type: 'idcard',
      name: fileName + '.' + (exportFormat === 'pdf' ? 'pdf' : exportFormat),
      idType: selectedIdType,
      scanMode,
    });

    toast.success(t('common.success'));
  } catch (err) {
    console.error(err);
    toast.error(t('common.error'));
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = originalText;
  }
}

async function exportAsPDF(frontSrc, backSrc, fileName, quality) {
  const isA4 = exportPageSize === 'a4';
  const pageW = isA4 ? 210 : 215.9; // mm
  const pageH = isA4 ? 297 : 279.4;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA4 ? 'a4' : 'letter'
  });

  // Draw front
  if (frontSrc) {
    const fp = cardPositions.front;
    const x = (fp.x / 100) * pageW;
    const y = (fp.y / 100) * pageH;
    const w = (fp.w / 100) * pageW;
    const h = (fp.h / 100) * pageH;
    pdf.addImage(frontSrc, 'JPEG', x, y, w, h, undefined, 'MEDIUM');
  }

  // Draw back
  if (backSrc && scanMode === 'double') {
    const bp = cardPositions.back;
    const x = (bp.x / 100) * pageW;
    const y = (bp.y / 100) * pageH;
    const w = (bp.w / 100) * pageW;
    const h = (bp.h / 100) * pageH;
    pdf.addImage(backSrc, 'JPEG', x, y, w, h, undefined, 'MEDIUM');
  }

  pdf.save(fileName + '.pdf');
}

async function exportAsImage(frontSrc, backSrc, fileName, format, quality) {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? '.png' : '.jpg';

  if (frontSrc) {
    const blob = dataURLtoBlob(await compressImage(frontSrc, quality, 3000));
    downloadBlob(blob, fileName + '_front' + ext);
  }
  if (backSrc && scanMode === 'double') {
    const blob = dataURLtoBlob(await compressImage(backSrc, quality, 3000));
    downloadBlob(blob, fileName + '_back' + ext);
  }
}

async function exportAsZip(frontSrc, backSrc, fileName) {
  const files = [];

  if (frontSrc) {
    const blob = dataURLtoBlob(frontSrc);
    const buf = await blob.arrayBuffer();
    files.push({ name: fileName + '_front.jpg', data: new Uint8Array(buf) });
  }
  if (backSrc) {
    const blob = dataURLtoBlob(backSrc);
    const buf = await blob.arrayBuffer();
    files.push({ name: fileName + '_back.jpg', data: new Uint8Array(buf) });
  }

  const zipBlob = createZipBlob(files);
  downloadBlob(zipBlob, fileName + '.zip');
}

function resetAll() {
  currentStep = 1;
  selectedIdType = 'aadhaar';
  scanMode = 'double';
  frontImage = null;
  backImage = null;
  frontEdited = null;
  backEdited = null;
  currentEditSide = 'front';
  activeTool = 'filters';
  activeFilter = 'original';
  brightness = 0;
  contrast = 0;
  eraserPoints = [];
  watermarkText = '';
  undoStack = [];
  redoStack = [];
  cardPositions = {
    front: { x: 10, y: 5, w: 80, h: 42 },
    back: { x: 10, y: 52, w: 80, h: 42 }
  };
  exportFormat = 'pdf';
  exportPageSize = 'a4';
  exportQuality = 85;
  refreshUI();
}

// =============================================
// DESTROY
// =============================================
export function destroy() {
  stopIdCamera();
}
