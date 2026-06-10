// ============================================
// ScanPro — Watermark Page
// ============================================

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import i18n from '../i18n.js';
import toast from '../toast.js';
import store from '../store.js';
import { readFileAsArrayBuffer, downloadBlob } from '../utils.js';

let uploadedFile = null;
let watermarkText = 'CONFIDENTIAL';
let fontSize = 48;
let opacity = 0.15;
let position = 'diagonal';
let color = '#000000';

export function render() {
  const t = (key) => i18n.t(key);
  return `
    <div class="watermark-container animate-fade-in-up">
      <div class="page-header">
        <h1 data-i18n="watermark.title">${t('watermark.title')}</h1>
        <p data-i18n="watermark.subtitle">${t('watermark.subtitle')}</p>
      </div>

      <!-- Upload -->
      <div id="watermark-upload" style="display:${uploadedFile ? 'none' : 'block'}">
        <div class="dropzone" id="watermark-dropzone">
          <div class="dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="dropzone-text">
            <h3 data-i18n="watermark.dropzone.title">${t('watermark.dropzone.title')}</h3>
            <p data-i18n="watermark.dropzone.subtitle">${t('watermark.dropzone.subtitle')}</p>
          </div>
          <input type="file" id="watermark-file-input" accept=".pdf" style="display:none;" />
        </div>
      </div>

      <!-- Watermark Editor -->
      <div id="watermark-editor" style="display:${uploadedFile ? 'block' : 'none'}">
        <!-- Preview -->
        <div class="watermark-preview mb-6" id="watermark-preview">
          <div style="width: 300px; height: 400px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <div style="color: #ccc; font-size: 0.8rem; text-align: center;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div>PDF</div>
            </div>
            <div class="watermark-text-overlay" id="watermark-overlay" style="opacity: ${opacity}; font-size: ${fontSize * 0.5}px; color: ${color}; ${position === 'diagonal' ? 'transform: rotate(-30deg);' : ''}">${watermarkText}</div>
          </div>
        </div>

        <!-- Controls -->
        <div class="watermark-controls">
          <div class="input-group">
            <label data-i18n="watermark.text">${t('watermark.text')}</label>
            <input type="text" class="input" id="watermark-text-input" value="${watermarkText}" data-i18n-placeholder="watermark.text.placeholder" placeholder="${t('watermark.text.placeholder')}" />
          </div>

          <div class="input-group">
            <label data-i18n="watermark.font">${t('watermark.font')}: <span id="font-size-val">${fontSize}</span>px</label>
            <input type="range" class="range-slider" id="font-size-slider" min="12" max="120" value="${fontSize}" />
          </div>

          <div class="input-group">
            <label data-i18n="watermark.opacity">${t('watermark.opacity')}: <span id="opacity-val">${Math.round(opacity * 100)}</span>%</label>
            <input type="range" class="range-slider" id="opacity-slider" min="5" max="50" value="${Math.round(opacity * 100)}" />
          </div>

          <div class="input-group">
            <label data-i18n="watermark.position">${t('watermark.position')}</label>
            <select class="select" id="watermark-position">
              <option value="center" ${position === 'center' ? 'selected' : ''} data-i18n="watermark.pos.center">${t('watermark.pos.center')}</option>
              <option value="diagonal" ${position === 'diagonal' ? 'selected' : ''} data-i18n="watermark.pos.diagonal">${t('watermark.pos.diagonal')}</option>
              <option value="tiled" ${position === 'tiled' ? 'selected' : ''} data-i18n="watermark.pos.tiled">${t('watermark.pos.tiled')}</option>
              <option value="topLeft" ${position === 'topLeft' ? 'selected' : ''} data-i18n="watermark.pos.topLeft">${t('watermark.pos.topLeft')}</option>
              <option value="topRight" ${position === 'topRight' ? 'selected' : ''} data-i18n="watermark.pos.topRight">${t('watermark.pos.topRight')}</option>
              <option value="bottomLeft" ${position === 'bottomLeft' ? 'selected' : ''} data-i18n="watermark.pos.bottomLeft">${t('watermark.pos.bottomLeft')}</option>
              <option value="bottomRight" ${position === 'bottomRight' ? 'selected' : ''} data-i18n="watermark.pos.bottomRight">${t('watermark.pos.bottomRight')}</option>
            </select>
          </div>

          <div class="input-group">
            <label data-i18n="watermark.color">${t('watermark.color')}</label>
            <input type="color" class="input" id="watermark-color" value="${color}" style="height: 40px; padding: 4px;" />
          </div>
        </div>

        <div class="action-bar mt-6">
          <button class="btn btn-secondary" id="watermark-reset">
            <span data-i18n="common.reset">${t('common.reset')}</span>
          </button>
          <button class="btn btn-primary btn-lg flex-1" id="watermark-apply-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span data-i18n="watermark.apply">${t('watermark.apply')}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  setupDropzone();
  setupControls();
  setupApply();
}

function setupDropzone() {
  const dropzone = document.getElementById('watermark-dropzone');
  const fileInput = document.getElementById('watermark-file-input');

  if (!dropzone) return;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    fileInput.value = '';
  });
}

function handleFile(file) {
  uploadedFile = file;
  document.getElementById('watermark-upload').style.display = 'none';
  document.getElementById('watermark-editor').style.display = 'block';
}

function setupControls() {
  // Text input
  document.getElementById('watermark-text-input')?.addEventListener('input', (e) => {
    watermarkText = e.target.value;
    updatePreview();
  });

  // Font size
  document.getElementById('font-size-slider')?.addEventListener('input', (e) => {
    fontSize = parseInt(e.target.value);
    document.getElementById('font-size-val').textContent = fontSize;
    updatePreview();
  });

  // Opacity
  document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
    opacity = parseInt(e.target.value) / 100;
    document.getElementById('opacity-val').textContent = parseInt(e.target.value);
    updatePreview();
  });

  // Position
  document.getElementById('watermark-position')?.addEventListener('change', (e) => {
    position = e.target.value;
    updatePreview();
  });

  // Color
  document.getElementById('watermark-color')?.addEventListener('input', (e) => {
    color = e.target.value;
    updatePreview();
  });

  // Reset
  document.getElementById('watermark-reset')?.addEventListener('click', () => {
    uploadedFile = null;
    watermarkText = 'CONFIDENTIAL';
    fontSize = 48;
    opacity = 0.15;
    position = 'diagonal';
    color = '#000000';
    refreshPage();
  });
}

function updatePreview() {
  const overlay = document.getElementById('watermark-overlay');
  if (overlay) {
    overlay.textContent = watermarkText;
    overlay.style.opacity = opacity;
    overlay.style.fontSize = (fontSize * 0.5) + 'px';
    overlay.style.color = color;

    switch (position) {
      case 'diagonal':
        overlay.style.transform = 'rotate(-30deg)';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.marginTop = '-20px';
        overlay.style.marginLeft = '-80px';
        break;
      case 'center':
        overlay.style.transform = 'none';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.marginTop = '-20px';
        overlay.style.marginLeft = '-80px';
        break;
      case 'topLeft':
        overlay.style.transform = 'none';
        overlay.style.top = '20px';
        overlay.style.left = '20px';
        overlay.style.marginTop = '0';
        overlay.style.marginLeft = '0';
        break;
      case 'bottomRight':
        overlay.style.transform = 'none';
        overlay.style.top = 'auto';
        overlay.style.bottom = '20px';
        overlay.style.right = '20px';
        overlay.style.left = 'auto';
        break;
      default:
        overlay.style.transform = 'rotate(-30deg)';
    }
  }
}

function setupApply() {
  document.getElementById('watermark-apply-btn')?.addEventListener('click', applyWatermark);
}

async function applyWatermark() {
  if (!uploadedFile) return;

  const btn = document.getElementById('watermark-apply-btn');
  const btnText = btn.querySelector('span');
  btn.disabled = true;
  btnText.textContent = i18n.t('watermark.applying');

  try {
    const buffer = await readFileAsArrayBuffer(uploadedFile);
    const pdfDoc = await PDFDocument.load(buffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return rgb(r, g, b);
    };

    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

      const drawOptions = {
        font,
        size: fontSize,
        color: hexToRgb(color),
        opacity: opacity,
      };

      switch (position) {
        case 'center':
          page.drawText(watermarkText, {
            x: (width - textWidth) / 2,
            y: height / 2,
            ...drawOptions,
          });
          break;

        case 'diagonal':
          page.drawText(watermarkText, {
            x: width / 4,
            y: height / 2,
            rotate: degrees(-45),
            ...drawOptions,
            size: fontSize * 1.2,
          });
          break;

        case 'tiled':
          for (let y = 0; y < height; y += fontSize * 4) {
            for (let x = -width; x < width * 2; x += textWidth + 60) {
              page.drawText(watermarkText, {
                x,
                y,
                rotate: degrees(-30),
                ...drawOptions,
                size: fontSize * 0.6,
              });
            }
          }
          break;

        case 'topLeft':
          page.drawText(watermarkText, { x: 30, y: height - 30 - fontSize, ...drawOptions });
          break;

        case 'topRight':
          page.drawText(watermarkText, { x: width - textWidth - 30, y: height - 30 - fontSize, ...drawOptions });
          break;

        case 'bottomLeft':
          page.drawText(watermarkText, { x: 30, y: 30, ...drawOptions });
          break;

        case 'bottomRight':
          page.drawText(watermarkText, { x: width - textWidth - 30, y: 30, ...drawOptions });
          break;
      }
    }

    const bytes = await pdfDoc.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `watermarked_${uploadedFile.name}`);

    await store.addHistory({
      type: 'watermark',
      name: `watermarked_${uploadedFile.name}`,
      size: bytes.length,
    });

    toast.success(i18n.t('common.success'));
  } catch (err) {
    console.error(err);
    toast.error(i18n.t('common.error'));
  } finally {
    btn.disabled = false;
    btnText.textContent = i18n.t('watermark.apply');
  }
}

function refreshPage() {
  const container = document.getElementById('page-content');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function destroy() {}
