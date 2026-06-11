// ============================================
// ScanPro — Main Application Entry Point
// ============================================

import i18n from './i18n.js';
import store from './store.js';
import toast from './toast.js';

// Import pages
import * as homePage from './pages/home.js';
import * as scannerPage from './pages/scanner.js';
import * as compressPage from './pages/compress.js';
import * as idcardPage from './pages/idcard.js';
import * as mergePage from './pages/merge.js';
import * as ocrPage from './pages/ocr.js';
import * as watermarkPage from './pages/watermark.js';
import * as historyPage from './pages/history.js';
import * as settingsPage from './pages/settings.js';

// Page registry
const pages = {
  home: homePage,
  scanner: scannerPage,
  compress: compressPage,
  idcard: idcardPage,
  merge: mergePage,
  ocr: ocrPage,
  watermark: watermarkPage,
  history: historyPage,
  settings: settingsPage,
};

let currentPage = null;

// Map which tab to highlight for each page
const pageToTab = {
  home: 'home',
  scanner: 'scanner',
  compress: 'home',
  idcard: 'home',
  merge: 'home',
  ocr: 'home',
  watermark: 'home',
  history: 'history',
  settings: 'settings',
};

// ---- Router ----
function getPageFromHash() {
  const hash = window.location.hash.replace('#/', '') || 'home';
  return pages[hash] ? hash : 'home';
}

function navigateTo(pageName) {
  // Destroy current page
  if (currentPage && pages[currentPage]?.destroy) {
    pages[currentPage].destroy();
  }

  currentPage = pageName;

  // Update bottom tab active state
  const activeTab = pageToTab[pageName] || 'home';
  document.querySelectorAll('.tab-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === activeTab);
  });

  // Render page
  const container = document.getElementById('page-content');
  const page = pages[pageName];

  if (page) {
    container.innerHTML = page.render();
    requestAnimationFrame(() => {
      page.init();
    });
  }

  // Scroll to top
  window.scrollTo(0, 0);

  // Update hash
  if (window.location.hash !== `#/${pageName}`) {
    history.pushState(null, '', `#/${pageName}`);
  }
}

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem('scanpro-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('scanpro-theme', next);
}

// ---- Language ----
function initLanguage() {
  i18n.updateDOM();
}

function toggleLanguage() {
  const newLang = i18n.toggleLanguage();
  // Re-render current page with new language
  if (currentPage && pages[currentPage]) {
    const container = document.getElementById('page-content');
    container.innerHTML = pages[currentPage].render();
    requestAnimationFrame(() => {
      pages[currentPage].init();
    });
  }
}

// ---- Service Worker ----
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration.scope);
        setInterval(() => registration.update(), 60 * 60 * 1000);
      } catch (err) {
        console.log('SW registration failed:', err);
      }
    });
  }
}

// ---- Offline / Online Detection ----
function setupOfflineDetection() {
  const offlineBanner = document.createElement('div');
  offlineBanner.id = 'offline-banner';
  offlineBanner.className = 'offline-banner';
  offlineBanner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
    </svg>
    <span>You are offline — the app still works!</span>
  `;
  document.body.prepend(offlineBanner);

  function updateStatus() {
    offlineBanner.classList.toggle('visible', !navigator.onLine);
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// ---- PWA Install ----
let deferredPrompt;
function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window._pwaInstallPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window._pwaInstallPrompt = null;
    console.log('PWA installed');
  });
}

// ---- Init ----
async function init() {
  await store.init();
  initTheme();
  initLanguage();
  registerServiceWorker();
  setupOfflineDetection();
  setupPWAInstall();

  // Bottom tab navigation
  document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Header theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Header language toggle
  document.getElementById('lang-toggle')?.addEventListener('click', toggleLanguage);

  // Hash routing
  window.addEventListener('hashchange', () => {
    navigateTo(getPageFromHash());
  });

  // Navigate to initial page
  navigateTo(getPageFromHash());
}

// Start app
document.addEventListener('DOMContentLoaded', init);
