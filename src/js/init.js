// ==================== DOMContentLoaded 初始化 ====================
window.addEventListener('DOMContentLoaded', function() {
  // 1. 安全执行所有核心模块初始化
  try { window.initGuestCookie(); } catch(e) { console.error('Guest load error:', e); }
  try { window.loadCookies(); } catch(e) { console.error('Cookies load error:', e); }
  try { window.chkAPI(); } catch(e) { console.error('API check error:', e); }
  try { window.initBg(); } catch(e) { console.error('Wallpaper init error:', e); }
  try { window.loadThemeSettings(); } catch(e) { console.error('Theme load error:', e); }

  try {
    var savedMask = localStorage.getItem('theme_mask_opacity');
    if (savedMask) {
      var maskRange = document.getElementById('maskOpacityRange');
      if (maskRange) maskRange.value = savedMask;
      window.changeMaskOpacity(savedMask);
    }
  } catch(e) { console.error(e); }

  // 2. 安全绑定所有输入框及按钮事件
  var ncIpt = document.getElementById('ncCookie');
  var blIpt = document.getElementById('blCookie');
  if (ncIpt) ncIpt.addEventListener('input', function() { window.saveCookie('nc'); });
  if (blIpt) blIpt.addEventListener('input', function() { window.saveCookie('bl'); });

  var sIpt = document.getElementById('sIpt');
  if (sIpt) {
    sIpt.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { window.hideSug(); window.sBtn(); }
      if (e.key === 'Escape') window.hideSug();
    });
  }

  var sBtnEl = document.getElementById('sBtn');
  if (sBtnEl) sBtnEl.addEventListener('click', window.sBtn);

  var biIpt = document.getElementById('biIpt');
  if (biIpt) {
    biIpt.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.biSearch();
    });
  }

  var biBtnEl = document.getElementById('biBtn');
  if (biBtnEl) biBtnEl.addEventListener('click', window.biSearch);
});

// 3. 全局冒泡事件监听
document.addEventListener('click', function(e) {
  var drop = document.getElementById('sDrop');
  if (drop && !e.target.closest('.s-wrap')) drop.classList.remove('show');
});

document.addEventListener('keydown', function(e) {
  // 屏蔽输入框中的空格误触播放
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    window.tPlay();
  }
  // ESC 键全局退出全屏或弹窗
  if (e.code === 'Escape') {
    var fullP = document.getElementById('fullP');
    if (fullP) fullP.classList.remove('show');
    document.body.classList.remove('fs-mode');
    if (typeof window.hdCL === 'function') window.hdCL();
  }
});
