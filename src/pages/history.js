// ============================================
// ScanPro — History Page
// ============================================

import i18n from '../i18n.js';
import toast from '../toast.js';
import store from '../store.js';
import { formatBytes, timeAgo } from '../utils.js';

let historyItems = [];

export function render() {
  const t = (key) => i18n.t(key);
  return `
    <div class="history-container animate-fade-in-up">
      <div class="page-header">
        <h1 data-i18n="history.title">${t('history.title')}</h1>
        <p data-i18n="history.subtitle">${t('history.subtitle')}</p>
      </div>

      ${historyItems.length > 0 ? `
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-secondary">${historyItems.length} items</span>
          <button class="btn btn-danger btn-sm" id="clear-history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span data-i18n="history.clearAll">${t('history.clearAll')}</span>
          </button>
        </div>

        <div class="history-list">
          ${historyItems.map(item => {
            const typeIcons = {
              scan: { class: 'scan', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' },
              compress: { class: 'compress', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/></svg>' },
              idcard: { class: 'idcard', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' },
              merge: { class: 'merge', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/></svg>' },
              split: { class: 'merge', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="12" y1="6" x2="12" y2="18"/></svg>' },
              watermark: { class: 'merge', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
            };

            const typeInfo = typeIcons[item.type] || typeIcons.scan;
            const typeLabel = t(`history.type.${item.type}`) || item.type;

            return `
              <div class="history-item animate-fade-in-up" data-id="${item.id}">
                <div class="history-item-icon ${typeInfo.class}">
                  ${typeInfo.icon}
                </div>
                <div class="history-item-info">
                  <div class="history-item-name">${item.name || 'Document'}</div>
                  <div class="history-item-meta">
                    <span class="badge badge-primary">${typeLabel}</span>
                    ${item.size ? ` • ${formatBytes(item.size)}` : ''}
                    ${item.pageCount ? ` • ${item.pageCount} ${t('merge.pages')}` : ''}
                    • ${timeAgo(item.timestamp, t('history.ago'))}
                  </div>
                </div>
                <div class="file-item-actions">
                  <button class="btn btn-ghost btn-icon" data-delete-history="${item.id}" title="${t('history.delete')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h3 data-i18n="history.empty">${t('history.empty')}</h3>
          <p data-i18n="history.emptyDesc">${t('history.emptyDesc')}</p>
        </div>
      `}
    </div>
  `;
}

export async function init() {
  await loadHistory();
  setupActions();
}

async function loadHistory() {
  try {
    historyItems = await store.getHistory();
    const container = document.getElementById('page-content');
    if (container) {
      container.innerHTML = render();
      setupActions();
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function setupActions() {
  document.getElementById('clear-history')?.addEventListener('click', async () => {
    if (confirm(i18n.t('common.confirm') + '?')) {
      await store.clearHistory();
      historyItems = [];
      const container = document.getElementById('page-content');
      if (container) {
        container.innerHTML = render();
        setupActions();
      }
      toast.success(i18n.t('common.success'));
    }
  });

  document.querySelectorAll('[data-delete-history]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.deleteHistory);
      await store.deleteHistory(id);
      historyItems = historyItems.filter(item => item.id !== id);
      const container = document.getElementById('page-content');
      if (container) {
        container.innerHTML = render();
        setupActions();
      }
    });
  });
}

export function destroy() {}
