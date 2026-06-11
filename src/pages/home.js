// ============================================
// ScanPro — Home Page (Tool Grid + Quick Scan)
// ============================================

import i18n from '../i18n.js';
import store from '../store.js';

const t = (key) => i18n.t(key);

const TOOLS = [
  {
    key: 'compress',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/></svg>`,
    color: '#3b82f6',
    bg: '#eff6ff',
    route: 'compress',
    subtitle: 'Reduce file size',
  },
  {
    key: 'idcard',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
    color: '#10b981',
    bg: '#ecfdf5',
    route: 'idcard',
    subtitle: 'Scan Aadhaar, PAN etc',
  },
  {
    key: 'merge',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/></svg>`,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    route: 'merge',
    subtitle: 'Combine PDF files',
  },
  {
    key: 'ocr',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    color: '#06b6d4',
    bg: '#ecfeff',
    route: 'ocr',
    subtitle: 'Extract text from image',
  },
  {
    key: 'watermark',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    color: '#ef4444',
    bg: '#fef2f2',
    route: 'watermark',
    subtitle: 'Mark your documents',
  },
  {
    key: 'history',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    color: '#f59e0b',
    bg: '#fffbeb',
    route: 'history',
    subtitle: 'All past scans',
  },
];

export function render() {
  return `
    <div class="home-container">
      <!-- Hero scan banner -->
      <div class="home-hero">
        <div class="home-hero-text">
          <h2>Scan any document</h2>
          <p>Photo · PDF · ID Card · OCR</p>
        </div>
        <button class="home-scan-btn" id="home-scan-btn">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>SCAN</span>
        </button>
      </div>

      <!-- Tools Grid -->
      <h3 class="home-section-title">All Tools</h3>
      <div class="home-tools-grid">
        ${TOOLS.map(tool => `
          <div class="home-tool-card" data-route="${tool.route}">
            <div class="home-tool-icon" style="background:${tool.bg}; color:${tool.color}">
              ${tool.icon}
            </div>
            <div class="home-tool-info">
              <span class="home-tool-name">${t('nav.' + tool.key)}</span>
              <span class="home-tool-sub">${tool.subtitle}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Recent Files -->
      <h3 class="home-section-title" id="recent-title" style="display:none">Recent Files</h3>
      <div id="home-recent-list" class="home-recent-list"></div>
    </div>
  `;
}

export function init() {
  // Tool card clicks
  document.querySelectorAll('.home-tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const route = card.dataset.route;
      window.location.hash = `#/${route}`;
    });
  });

  // Hero scan button
  document.getElementById('home-scan-btn')?.addEventListener('click', () => {
    window.location.hash = '#/scanner';
  });

  // Load recent files
  loadRecentFiles();
}

async function loadRecentFiles() {
  try {
    const history = await store.getHistory();
    const recent = history.slice(0, 5);

    const listEl = document.getElementById('home-recent-list');
    const titleEl = document.getElementById('recent-title');

    if (recent.length === 0 || !listEl) return;

    if (titleEl) titleEl.style.display = 'block';

    const typeIcons = {
      scan: '📄', compress: '📦', idcard: '🪪',
      merge: '📑', split: '✂️', watermark: '🛡️',
    };

    const typeBadges = {
      scan: 'PDF', compress: 'PDF', idcard: 'ID',
      merge: 'PDF', split: 'PDF', watermark: 'PDF',
    };

    listEl.innerHTML = recent.map(item => {
      const icon = typeIcons[item.type] || '📄';
      const badge = typeBadges[item.type] || 'PDF';
      const date = item.timestamp
        ? new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : 'Today';
      const pages = item.pageCount ? `${item.pageCount} page${item.pageCount > 1 ? 's' : ''}` : '';

      return `
        <div class="home-recent-item">
          <div class="home-recent-icon">${icon}</div>
          <div class="home-recent-info">
            <span class="home-recent-name">${item.name || 'Document'}</span>
            <span class="home-recent-meta">${pages}${pages && date ? ' · ' : ''}${date}</span>
          </div>
          <span class="home-recent-badge">${badge}</span>
          <svg class="home-recent-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
    }).join('');
  } catch (e) {
    // History may be empty, that's fine
  }
}

export function destroy() {}
