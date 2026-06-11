// ============================================
// ScanPro — Settings Page
// ============================================

import i18n from '../i18n.js';
import store from '../store.js';
import toast from '../toast.js';

const t = (key) => i18n.t(key);

function isAppInstalled() {
  // Check if running in standalone mode (already installed)
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function render() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const currentLang = i18n.getLanguage();
  const installed = isAppInstalled();

  return `
    <div class="settings-container">
      <div class="page-header">
        <h1>Settings</h1>
      </div>

      <div class="settings-group">
        <h3 class="settings-group-title">Appearance</h3>
        <div class="settings-item" id="setting-theme">
          <div class="settings-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>
            <span>Theme</span>
          </div>
          <span class="settings-item-value" id="theme-value">${currentTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
        </div>
        <div class="settings-item" id="setting-lang">
          <div class="settings-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span>Language</span>
          </div>
          <span class="settings-item-value" id="lang-value">${currentLang === 'en' ? 'English' : 'বাংলা'}</span>
        </div>
      </div>

      <div class="settings-group">
        <h3 class="settings-group-title">App</h3>
        <div class="settings-item settings-install-item" id="setting-install">
          <div class="settings-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span style="color: var(--primary-500); font-weight: 600;">Install the App</span>
          </div>
          ${installed
            ? '<span class="settings-installed-badge">✓ Installed</span>'
            : `<span class="settings-item-value">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </span>`
          }
        </div>
      </div>

      <div class="settings-group">
        <h3 class="settings-group-title">Data</h3>
        <div class="settings-item settings-item-danger" id="setting-clear-history">
          <div class="settings-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span>Clear All History</span>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h3 class="settings-group-title">About</h3>
        <div class="settings-item">
          <div class="settings-item-left">
            <span>Version</span>
          </div>
          <span class="settings-item-value">5.4.2</span>
        </div>
        <div class="settings-item">
          <div class="settings-item-left">
            <span>Made with ❤️</span>
          </div>
          <span class="settings-item-value">Pie Scanner</span>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  document.getElementById('setting-theme')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('scanpro-theme', next);
    const val = document.getElementById('theme-value');
    if (val) val.textContent = next === 'dark' ? '🌙 Dark' : '☀️ Light';
  });

  document.getElementById('setting-lang')?.addEventListener('click', () => {
    const newLang = i18n.toggleLanguage();
    const val = document.getElementById('lang-value');
    if (val) val.textContent = newLang === 'en' ? 'English' : 'বাংলা';
    // Re-render page
    const container = document.getElementById('page-content');
    if (container) {
      container.innerHTML = render();
      requestAnimationFrame(() => init());
    }
  });

  document.getElementById('setting-clear-history')?.addEventListener('click', async () => {
    if (confirm('Clear all history? This cannot be undone.')) {
      await store.clearHistory();
      toast.success('History cleared');
    }
  });

  // Install App button
  document.getElementById('setting-install')?.addEventListener('click', async () => {
    const installed = isAppInstalled();
    if (installed) {
      toast.success('App is already installed!');
      return;
    }

    const prompt = window._pwaInstallPrompt;
    if (prompt) {
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('App installed successfully! 🎉');
          window._pwaInstallPrompt = null;
          // Update the UI
          const container = document.getElementById('page-content');
          if (container) {
            container.innerHTML = render();
            requestAnimationFrame(() => init());
          }
        }
      } catch (err) {
        console.error('Install error:', err);
      }
    } else {
      // Fallback: show instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast.info('Tap the Share button ⬆ then "Add to Home Screen"');
      } else {
        toast.info('Use your browser menu → "Install App" or "Add to Home Screen"');
      }
    }
  });
}

export function destroy() {}
