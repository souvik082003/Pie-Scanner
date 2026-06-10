// ============================================
// ScanPro — OCR Page
// ============================================

import i18n from '../i18n.js';
import toast from '../toast.js';
import { readFileAsDataURL } from '../utils.js';

let ocrImage = null;
let extractedText = '';
let selectedLang = 'eng';
let isProcessing = false;

export function render() {
  const t = (key) => i18n.t(key);
  return `
    <div class="ocr-container animate-fade-in-up">
      <div class="page-header">
        <h1 data-i18n="ocr.title">${t('ocr.title')}</h1>
        <p data-i18n="ocr.subtitle">${t('ocr.subtitle')}</p>
      </div>

      <!-- Upload -->
      <div id="ocr-upload" style="display:${ocrImage ? 'none' : 'block'}">
        <div class="dropzone" id="ocr-dropzone">
          <div class="dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
          </div>
          <div class="dropzone-text">
            <h3 data-i18n="ocr.dropzone.title">${t('ocr.dropzone.title')}</h3>
            <p data-i18n="ocr.dropzone.subtitle">${t('ocr.dropzone.subtitle')}</p>
          </div>
          <input type="file" id="ocr-file-input" accept="image/*" style="display:none;" />
        </div>
      </div>

      <!-- Processing -->
      <div id="ocr-workspace" style="display:${ocrImage ? 'block' : 'none'}">
        <!-- Image preview -->
        <div class="card mb-6">
          <div class="flex items-center gap-4">
            <div style="width:80px;height:60px;border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;">
              <img id="ocr-preview" src="${ocrImage || ''}" alt="OCR" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <div class="flex-1">
              <div class="input-group">
                <label data-i18n="ocr.language">${t('ocr.language')}</label>
                <select class="select" id="ocr-lang">
                  <option value="eng" ${selectedLang === 'eng' ? 'selected' : ''} data-i18n="ocr.lang.eng">${t('ocr.lang.eng')}</option>
                  <option value="hin" ${selectedLang === 'hin' ? 'selected' : ''} data-i18n="ocr.lang.hin">${t('ocr.lang.hin')}</option>
                  <option value="ben" ${selectedLang === 'ben' ? 'selected' : ''} data-i18n="ocr.lang.ben">${t('ocr.lang.ben')}</option>
                </select>
              </div>
            </div>
            <button class="btn btn-ghost btn-icon" id="ocr-change">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Progress -->
        <div id="ocr-progress-section" style="display:none;" class="mb-6">
          <div class="card text-center">
            <div class="mb-4">
              <div class="spinner" style="width:32px;height:32px;border:3px solid var(--border-primary);border-top-color:var(--primary-500);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;"></div>
            </div>
            <p class="text-sm" data-i18n="ocr.progress" id="ocr-progress-text">${t('ocr.progress')}</p>
            <div class="progress-bar mt-4">
              <div class="progress-bar-fill" id="ocr-progress-bar" style="width:0%"></div>
            </div>
          </div>
        </div>

        <!-- Extract Button -->
        <div id="ocr-extract-section" style="display:${!extractedText && !isProcessing ? 'block' : 'none'}">
          <button class="btn btn-primary btn-lg btn-block" id="ocr-extract-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            <span data-i18n="ocr.extract">${t('ocr.extract')}</span>
          </button>
        </div>

        <!-- Result -->
        <div id="ocr-result" style="display:${extractedText ? 'block' : 'none'}">
          <div class="ocr-result">
            <div class="ocr-result-header">
              <h3 class="font-semibold" data-i18n="ocr.result">${t('ocr.result')}</h3>
              <button class="btn btn-secondary btn-sm" id="ocr-copy-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span data-i18n="ocr.copy">${t('ocr.copy')}</span>
              </button>
            </div>
            <div class="ocr-text" id="ocr-text-content">${extractedText}</div>
          </div>

          <div class="action-bar mt-4">
            <button class="btn btn-secondary" id="ocr-new-btn">
              <span data-i18n="common.reset">${t('common.reset')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  setupDropzone();
  setupExtract();
  setupActions();
}

function setupDropzone() {
  const dropzone = document.getElementById('ocr-dropzone');
  const fileInput = document.getElementById('ocr-file-input');

  if (!dropzone) return;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    fileInput.value = '';
  });
}

async function handleFile(file) {
  const dataUrl = await readFileAsDataURL(file);
  ocrImage = dataUrl;
  extractedText = '';
  isProcessing = false;

  refreshPage();
}

function setupExtract() {
  document.getElementById('ocr-extract-btn')?.addEventListener('click', extractText);
  document.getElementById('ocr-lang')?.addEventListener('change', (e) => {
    selectedLang = e.target.value;
  });
}

async function extractText() {
  if (!ocrImage) return;

  isProcessing = true;
  document.getElementById('ocr-extract-section').style.display = 'none';
  document.getElementById('ocr-progress-section').style.display = 'block';

  try {
    // Dynamically import Tesseract
    const Tesseract = await import('tesseract.js');
    const { createWorker } = Tesseract;

    const worker = await createWorker(selectedLang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          const bar = document.getElementById('ocr-progress-bar');
          const text = document.getElementById('ocr-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (text) text.textContent = `${i18n.t('ocr.progress')} ${pct}%`;
        }
      }
    });

    const { data: { text } } = await worker.recognize(ocrImage);
    await worker.terminate();

    extractedText = text.trim() || i18n.t('ocr.noText');
    isProcessing = false;

    refreshPage();
    toast.success(i18n.t('common.success'));
  } catch (err) {
    console.error(err);
    isProcessing = false;
    toast.error(i18n.t('common.error'));
    document.getElementById('ocr-progress-section').style.display = 'none';
    document.getElementById('ocr-extract-section').style.display = 'block';
  }
}

function setupActions() {
  document.getElementById('ocr-copy-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      toast.success(i18n.t('ocr.copied'));
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = extractedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(i18n.t('ocr.copied'));
    }
  });

  document.getElementById('ocr-change')?.addEventListener('click', resetOCR);
  document.getElementById('ocr-new-btn')?.addEventListener('click', resetOCR);
}

function resetOCR() {
  ocrImage = null;
  extractedText = '';
  isProcessing = false;
  refreshPage();
}

function refreshPage() {
  const container = document.getElementById('page-content');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function destroy() {}
