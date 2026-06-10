// ============================================
// ScanPro — Merge & Split Page
// ============================================

import { PDFDocument } from 'pdf-lib';
import i18n from '../i18n.js';
import toast from '../toast.js';
import store from '../store.js';
import { formatBytes, readFileAsArrayBuffer, downloadBlob } from '../utils.js';

let mergeFiles = []; // { file, name, size, pageCount }
let splitFile = null;
let splitPageCount = 0;
let selectedPages = new Set();
let activeTab = 'merge';

export function render() {
  const t = (key) => i18n.t(key);
  return `
    <div class="merge-split-container animate-fade-in-up">
      <div class="page-header">
        <h1 data-i18n="merge.title">${t('merge.title')}</h1>
        <p data-i18n="merge.subtitle">${t('merge.subtitle')}</p>
      </div>

      <!-- Tabs -->
      <div class="tabs mb-6">
        <button class="tab ${activeTab === 'merge' ? 'active' : ''}" data-tab="merge" data-i18n="merge.tab.merge">${t('merge.tab.merge')}</button>
        <button class="tab ${activeTab === 'split' ? 'active' : ''}" data-tab="split" data-i18n="merge.tab.split">${t('merge.tab.split')}</button>
      </div>

      <!-- Merge Tab -->
      <div id="merge-tab" style="display:${activeTab === 'merge' ? 'block' : 'none'}">
        <div class="dropzone" id="merge-dropzone">
          <div class="dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          </div>
          <div class="dropzone-text">
            <h3 data-i18n="merge.dropzone.title">${t('merge.dropzone.title')}</h3>
            <p data-i18n="merge.dropzone.subtitle">${t('merge.dropzone.subtitle')}</p>
          </div>
          <input type="file" id="merge-file-input" accept=".pdf" multiple style="display:none;" />
        </div>

        <!-- File List -->
        <div id="merge-file-list" class="mt-6" style="display:${mergeFiles.length > 0 ? 'block' : 'none'}">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">${mergeFiles.length} <span data-i18n="merge.files">${t('merge.files')}</span></h3>
            <button class="btn btn-secondary btn-sm" id="merge-add-more">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span data-i18n="merge.addMore">${t('merge.addMore')}</span>
            </button>
          </div>
          <div class="file-list" id="merge-files">
            ${mergeFiles.map((f, i) => `
              <div class="file-item" draggable="true" data-index="${i}">
                <div class="file-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="file-item-info">
                  <div class="file-item-name">${f.name}</div>
                  <div class="file-item-size">${formatBytes(f.size)} • ${f.pageCount} ${t('merge.pages')}</div>
                </div>
                <div class="file-item-actions">
                  <button class="btn btn-ghost btn-icon" data-remove-merge="${i}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="action-bar">
            <button class="btn btn-primary btn-lg btn-block" id="merge-btn" ${mergeFiles.length < 2 ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/></svg>
              <span data-i18n="merge.merge">${t('merge.merge')}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Split Tab -->
      <div id="split-tab" style="display:${activeTab === 'split' ? 'block' : 'none'}">
        <div id="split-upload" style="display:${splitFile ? 'none' : 'block'}">
          <div class="dropzone" id="split-dropzone">
            <div class="dropzone-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
            </div>
            <div class="dropzone-text">
              <h3 data-i18n="split.dropzone.title">${t('split.dropzone.title')}</h3>
              <p data-i18n="split.dropzone.subtitle">${t('split.dropzone.subtitle')}</p>
            </div>
            <input type="file" id="split-file-input" accept=".pdf" style="display:none;" />
          </div>
        </div>

        <!-- Page Selection -->
        <div id="split-pages" style="display:${splitFile ? 'block' : 'none'}">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold" data-i18n="split.selectPages">${t('split.selectPages')}</h3>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm" id="split-select-all" data-i18n="split.selectAll">${t('split.selectAll')}</button>
              <button class="btn btn-ghost btn-sm" id="split-deselect-all" data-i18n="split.deselectAll">${t('split.deselectAll')}</button>
            </div>
          </div>

          <div class="page-grid" id="split-page-grid">
            ${Array.from({length: splitPageCount}, (_, i) => `
              <div class="page-thumb ${selectedPages.has(i) ? 'selected' : ''}" data-page="${i}">
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-tertiary);font-size:var(--font-size-2xl);font-weight:700;">${i + 1}</div>
                <span class="page-thumb-number">${t('scanner.page')} ${i + 1}</span>
                <span class="page-thumb-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              </div>
            `).join('')}
          </div>

          <div class="action-bar">
            <button class="btn btn-secondary" id="split-reset">
              <span data-i18n="common.reset">${t('common.reset')}</span>
            </button>
            <button class="btn btn-primary btn-lg flex-1" id="split-btn" ${selectedPages.size === 0 ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
              <span data-i18n="split.extract">${t('split.extract')}</span> (${selectedPages.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  setupTabs();
  setupMerge();
  setupSplit();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('merge-tab').style.display = activeTab === 'merge' ? 'block' : 'none';
      document.getElementById('split-tab').style.display = activeTab === 'split' ? 'block' : 'none';
    });
  });
}

function setupMerge() {
  const dropzone = document.getElementById('merge-dropzone');
  const fileInput = document.getElementById('merge-file-input');

  if (!dropzone) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) await addMergeFiles(files);
  });

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) await addMergeFiles(files);
    fileInput.value = '';
  });

  document.getElementById('merge-add-more')?.addEventListener('click', () => fileInput.click());

  // Remove buttons
  document.getElementById('page-content')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-merge]');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.removeMerge);
      mergeFiles.splice(idx, 1);
      refreshPage();
    }
  });

  document.getElementById('merge-btn')?.addEventListener('click', mergePDFs);
}

async function addMergeFiles(files) {
  for (const file of files) {
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const pdf = await PDFDocument.load(buffer);
      mergeFiles.push({
        file,
        name: file.name,
        size: file.size,
        pageCount: pdf.getPageCount(),
        buffer,
      });
    } catch (err) {
      toast.error(`Failed to load ${file.name}`);
    }
  }
  refreshPage();
}

async function mergePDFs() {
  if (mergeFiles.length < 2) return;

  const btn = document.getElementById('merge-btn');
  const btnText = btn.querySelector('span');
  btn.disabled = true;
  btnText.textContent = i18n.t('merge.merging');

  try {
    const mergedPdf = await PDFDocument.create();

    for (const f of mergeFiles) {
      const srcPdf = await PDFDocument.load(f.buffer);
      const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    downloadBlob(blob, `merged_${mergeFiles.length}_files.pdf`);

    await store.addHistory({
      type: 'merge',
      name: `Merged_${mergeFiles.length}_files.pdf`,
      fileCount: mergeFiles.length,
      size: mergedBytes.length,
    });

    toast.success(i18n.t('common.success'));
    mergeFiles = [];
    refreshPage();
  } catch (err) {
    console.error(err);
    toast.error(i18n.t('common.error'));
  } finally {
    btn.disabled = false;
    btnText.textContent = i18n.t('merge.merge');
  }
}

function setupSplit() {
  const dropzone = document.getElementById('split-dropzone');
  const fileInput = document.getElementById('split-file-input');

  if (!dropzone) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') await handleSplitFile(file);
  });

  fileInput.addEventListener('change', async (e) => {
    if (e.target.files[0]) await handleSplitFile(e.target.files[0]);
    fileInput.value = '';
  });

  // Page selection
  document.getElementById('page-content')?.addEventListener('click', (e) => {
    const pageThumb = e.target.closest('.page-thumb');
    if (pageThumb && document.getElementById('split-page-grid')?.contains(pageThumb)) {
      const pageIdx = parseInt(pageThumb.dataset.page);
      if (selectedPages.has(pageIdx)) {
        selectedPages.delete(pageIdx);
        pageThumb.classList.remove('selected');
      } else {
        selectedPages.add(pageIdx);
        pageThumb.classList.add('selected');
      }
      updateSplitBtn();
    }
  });

  document.getElementById('split-select-all')?.addEventListener('click', () => {
    selectedPages = new Set(Array.from({length: splitPageCount}, (_, i) => i));
    document.querySelectorAll('.page-thumb').forEach(t => t.classList.add('selected'));
    updateSplitBtn();
  });

  document.getElementById('split-deselect-all')?.addEventListener('click', () => {
    selectedPages.clear();
    document.querySelectorAll('.page-thumb').forEach(t => t.classList.remove('selected'));
    updateSplitBtn();
  });

  document.getElementById('split-reset')?.addEventListener('click', () => {
    splitFile = null;
    splitPageCount = 0;
    selectedPages.clear();
    refreshPage();
  });

  document.getElementById('split-btn')?.addEventListener('click', splitPDF);
}

async function handleSplitFile(file) {
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(buffer);
    splitFile = { file, buffer, name: file.name };
    splitPageCount = pdf.getPageCount();
    selectedPages.clear();
    refreshPage();
  } catch (err) {
    toast.error(i18n.t('common.error'));
  }
}

function updateSplitBtn() {
  const btn = document.getElementById('split-btn');
  if (btn) {
    btn.disabled = selectedPages.size === 0;
    btn.querySelector('span').textContent = `${i18n.t('split.extract')} (${selectedPages.size})`;
  }
}

async function splitPDF() {
  if (!splitFile || selectedPages.size === 0) return;

  const btn = document.getElementById('split-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = i18n.t('split.extracting');

  try {
    const srcPdf = await PDFDocument.load(splitFile.buffer);
    const newPdf = await PDFDocument.create();

    const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
    const pages = await newPdf.copyPages(srcPdf, sortedPages);
    pages.forEach(page => newPdf.addPage(page));

    const bytes = await newPdf.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `split_${selectedPages.size}_pages.pdf`);

    await store.addHistory({
      type: 'split',
      name: `Split_${selectedPages.size}_pages.pdf`,
      pageCount: selectedPages.size,
      size: bytes.length,
    });

    toast.success(i18n.t('common.success'));
  } catch (err) {
    console.error(err);
    toast.error(i18n.t('common.error'));
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = i18n.t('split.extract');
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
