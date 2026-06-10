// ============================================
// ScanPro — Main Application Entry Point
// ============================================

import i18n from './i18n.js';
import store from './store.js';

// Import pages
import * as scannerPage from './pages/scanner.js';
import * as compressPage from './pages/compress.js';
import * as idcardPage from './pages/idcard.js';
import * as mergePage from './pages/merge.js';
import * as ocrPage from './pages/ocr.js';
import * as watermarkPage from './pages/watermark.js';
import * as historyPage from './pages/history.js';

// Page registry
const pages = {
  scanner: scannerPage,
  compress: compressPage,
  idcard: idcardPage,
  merge: mergePage,
  ocr: ocrPage,
  watermark: watermarkPage,
  history: historyPage,
};

let currentPage = null;

// ---- Router ----
function getPageFromHash() {
  const hash = window.location.hash.replace('#/', '') || 'scanner';
  return pages[hash] ? hash : 'scanner';
}

function navigateTo(pageName) {
  // Destroy current page
  if (currentPage && pages[currentPage]?.destroy) {
    pages[currentPage].destroy();
  }

  currentPage = pageName;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  // Render page
  const container = document.getElementById('page-content');
  const page = pages[pageName];

  if (page) {
    container.innerHTML = page.render();
    // Call init after DOM is in place
    requestAnimationFrame(() => {
      page.init();
    });
  }

  // Close mobile sidebar
  closeSidebar();

  // Update hash
  if (window.location.hash !== `#/${pageName}`) {
    history.pushState(null, '', `#/${pageName}`);
  }
}

// ---- Sidebar ----
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('visible');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem('scanpro-theme') || 'dark';
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

        // Check for updates periodically
        setInterval(() => registration.update(), 60 * 60 * 1000); // every hour

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              toast.info(i18n.getLanguage() === 'bn'
                ? 'নতুন আপডেট পাওয়া গেছে! রিফ্রেশ করুন।'
                : 'New update available! Refresh to update.');
            }
          });
        });
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
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
    <span id="offline-text">${i18n.getLanguage() === 'bn' ? 'আপনি অফলাইনে আছেন — অ্যাপটি এখনও কাজ করবে!' : 'You are offline — the app still works!'}</span>
  `;
  document.body.prepend(offlineBanner);

  function updateStatus() {
    const isOffline = !navigator.onLine;
    offlineBanner.classList.toggle('visible', isOffline);

    // Update main content top margin when banner is visible
    const main = document.getElementById('main-content');
    if (main) {
      main.style.paddingTop = isOffline ? '40px' : '0';
    }
  }

  window.addEventListener('online', () => {
    updateStatus();
    toast.success(i18n.getLanguage() === 'bn'
      ? 'আবার অনলাইনে সংযুক্ত!'
      : 'Back online!');
  });

  window.addEventListener('offline', () => {
    updateStatus();
    toast.warning(i18n.getLanguage() === 'bn'
      ? 'ইন্টারনেট সংযোগ বিচ্ছিন্ন। অফলাইন মোডে চলছে।'
      : 'No internet connection. Running in offline mode.');
  });

  // Initial check
  updateStatus();
}

// ---- PWA Install ----
let deferredPrompt;
function setupPWAInstall() {
  const installBtn = document.getElementById('install-app-btn');
  if (!installBtn) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    installBtn.style.display = 'flex';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    deferredPrompt = null;
    console.log('PWA was installed');
  });
}

// ---- Init ----
async function init() {
  // Initialize store
  await store.init();

  // Init theme
  initTheme();

  // Init language
  initLanguage();

  // Register service worker
  registerServiceWorker();

  // Setup offline detection
  setupOfflineDetection();

  // Setup PWA installation
  setupPWAInstall();

  // Setup navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Mobile sidebar
  document.getElementById('hamburger')?.addEventListener('click', openSidebar);
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Theme toggles
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('theme-toggle-mobile')?.addEventListener('click', toggleTheme);

  // Language toggles
  document.getElementById('lang-toggle')?.addEventListener('click', toggleLanguage);
  document.getElementById('lang-toggle-mobile')?.addEventListener('click', toggleLanguage);

  // Hash routing
  window.addEventListener('hashchange', () => {
    navigateTo(getPageFromHash());
  });

  // Navigate to initial page
  navigateTo(getPageFromHash());
}

// Start app
document.addEventListener('DOMContentLoaded', init);
