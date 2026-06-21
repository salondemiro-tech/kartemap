/* shared_ui.js
 * カルテマップ - UI共通処理（ローディング・トースト・エスケープ）
 * ES5のみ（var/function/Promise.then）。const/let/アロー関数/async/await禁止。
 * 自己注入式：必要なDOM・CSSを自動で挿入する。
 */

/* ローディングの多重表示をカウンタで管理（TORITAの教訓）。
 * incrementとhideを必ず対応させ、エラー時もuiForceHideLoading()で確実に消す。
 */
var UI_LOADING_COUNT = 0;

/* 共通CSSとDOMを自己注入する */
function uiInject() {
  if (document.getElementById('tui-style')) {
    return;
  }
  var css =
    '.tui-loading-overlay{position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(255,255,255,0.7);display:none;align-items:center;' +
    'justify-content:center;z-index:9999;}' +
    '.tui-loading-overlay.tui-show{display:flex;}' +
    '.tui-spinner{width:48px;height:48px;border:5px solid #e0d5c5;' +
    'border-top-color:#a87f5c;border-radius:50%;animation:tui-spin 0.8s linear infinite;}' +
    '@keyframes tui-spin{to{transform:rotate(360deg);}}' +
    '.tui-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'background:#5a4632;color:#fff;padding:12px 20px;border-radius:8px;' +
    'font-size:14px;z-index:10000;opacity:0;transition:opacity 0.3s;' +
    'max-width:90%;box-sizing:border-box;}' +
    '.tui-toast.tui-show{opacity:1;}';

  var style = document.createElement('style');
  style.id = 'tui-style';
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = 'tui-loading';
  overlay.className = 'tui-loading-overlay';
  var spinner = document.createElement('div');
  spinner.className = 'tui-spinner';
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);

  var toast = document.createElement('div');
  toast.id = 'tui-toast';
  toast.className = 'tui-toast';
  document.body.appendChild(toast);
}

/* ローディング表示（カウンタ加算） */
function uiShowLoading() {
  uiInject();
  UI_LOADING_COUNT = UI_LOADING_COUNT + 1;
  var el = document.getElementById('tui-loading');
  if (el) {
    el.className = 'tui-loading-overlay tui-show';
  }
}

/* ローディング非表示（カウンタ減算。0になったら消す） */
function uiHideLoading() {
  UI_LOADING_COUNT = UI_LOADING_COUNT - 1;
  if (UI_LOADING_COUNT < 0) {
    UI_LOADING_COUNT = 0;
  }
  if (UI_LOADING_COUNT === 0) {
    var el = document.getElementById('tui-loading');
    if (el) {
      el.className = 'tui-loading-overlay';
    }
  }
}

/* ローディングを強制的に消す（エラー時の確実な復帰用） */
function uiForceHideLoading() {
  UI_LOADING_COUNT = 0;
  var el = document.getElementById('tui-loading');
  if (el) {
    el.className = 'tui-loading-overlay';
  }
}

/* トースト表示 */
var UI_TOAST_TIMER = null;
function uiToast(message) {
  uiInject();
  var el = document.getElementById('tui-toast');
  if (!el) {
    return;
  }
  el.innerHTML = '';
  el.appendChild(document.createTextNode(message));
  el.className = 'tui-toast tui-show';
  if (UI_TOAST_TIMER) {
    clearTimeout(UI_TOAST_TIMER);
  }
  UI_TOAST_TIMER = setTimeout(function () {
    el.className = 'tui-toast';
  }, 2800);
}

/* HTMLエスケープ（XSS対策。innerHTMLに値を入れる際は必ず通す） */
function uiEscape(text) {
  if (text === null || text === undefined) {
    return '';
  }
  var s = String(text);
  s = s.replace(/&/g, '&amp;');
  s = s.replace(/</g, '&lt;');
  s = s.replace(/>/g, '&gt;');
  s = s.replace(/"/g, '&quot;');
  s = s.replace(/'/g, '&#39;');
  return s;
}
