// ══════════════════════════════════════════════════════
//  I18N ENGINE
//  Usage:
//    t('editor.titlePlaceholder')   → string in current locale
//    setLocale('en')                → switch language + re-render
//    getLocale()                    → 'es' | 'en'
//
//  Locale string files live in i18n/{locale}/{component}.js
//  Each file appends its namespace to window.GM_I18N[locale].
// ══════════════════════════════════════════════════════

window.GM_I18N = window.GM_I18N || {};

const I18N_LS_KEY = 'graphmind_locale';
let _locale = localStorage.getItem(I18N_LS_KEY) || 'es';

function getLocale() { return _locale; }

function t(key) {
  const [ns, ...rest] = key.split('.');
  const k = rest.join('.');
  const val = GM_I18N[_locale]?.[ns]?.[k]
           ?? GM_I18N['es']?.[ns]?.[k]   // fallback to Spanish
           ?? key;                        // last resort: the key itself
  return val;
}

function setLocale(lang) {
  _locale = lang;
  localStorage.setItem(I18N_LS_KEY, lang);
  applyTranslations();
  // Re-render dynamic parts that build HTML from JS
  if (typeof renderList          === 'function') renderList();
  if (typeof renderEditor        === 'function') renderEditor();
  if (typeof renderStatusFilterButtons === 'function') renderStatusFilterButtons();
  if (typeof updateCount         === 'function') updateCount();
  if (typeof renderGraphLegend   === 'function' && typeof currentView !== 'undefined' && currentView === 'graph') renderGraphLegend();
  // Update language toggle button appearance
  _updateLangBtn();
}

// ── DOM walker ────────────────────────────────────────────────────────────────
// Call once after loader injects all partials, and again on locale change.
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val !== el.dataset.i18n) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const val = t(el.dataset.i18nPlaceholder);
    if (val !== el.dataset.i18nPlaceholder) el.placeholder = val;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const val = t(el.dataset.i18nTitle);
    if (val !== el.dataset.i18nTitle) el.title = val;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const val = t(el.dataset.i18nHtml);
    if (val !== el.dataset.i18nHtml) el.innerHTML = val;
  });
}

function _updateLangBtn() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.textContent  = _locale === 'es' ? '🇬🇧' : '🇪🇸';
  btn.title        = _locale === 'es' ? 'Switch to English' : 'Cambiar a Español';
}
