// ==================== 主题样式更新 ====================
window.updateThemeStyle = function() {
  var type = document.getElementById('transTypeSel').value;
  var opacity = parseFloat(document.getElementById('transOpacityRange').value);
  var blurVal = document.getElementById('blurSel').value;

  document.getElementById('transOpacityVal').textContent = Math.round(opacity * 100) + '%';

  var root = document.documentElement;
  root.style.setProperty('--opacity-val', opacity);

  if (type === 'transparent') {
    root.style.setProperty('--blur-val', 'none');
  } else if (type === 'blur') {
    root.style.setProperty('--blur-val', 'blur(' + blurVal + ')');
  } else if (type === 'acrylic') {
    root.style.setProperty('--blur-val', 'blur(' + blurVal + ') saturate(180%)');
  }

  localStorage.setItem('theme_trans_type', type);
  localStorage.setItem('theme_trans_opacity', opacity);
  localStorage.setItem('theme_card_blur_val', blurVal);

  var temp = root.style.transform;
  root.style.transform = 'translateZ(0.01px)';
  root.offsetHeight;
  requestAnimationFrame(function() { root.style.transform = temp; });
};

window.changeBlur = function() { window.updateThemeStyle(); };

window.changeFpBlur = function(val) {
  document.documentElement.style.setProperty('--fp-blur-val', val);
  localStorage.setItem('theme_fp_blur_val', val);
};

window.changeFpOpacity = function(val) {
  document.documentElement.style.setProperty('--fp-opacity-val', val);
  document.getElementById('fpOpacityVal').textContent = Math.round(val * 100) + '%';
  localStorage.setItem('theme_fp_opacity_val', val);
};

window.loadThemeSettings = function() {
  var type = localStorage.getItem('theme_trans_type') || 'blur';
  var opacity = localStorage.getItem('theme_trans_opacity') || '0.5';
  var blurVal = localStorage.getItem('theme_card_blur_val') || '12px';

  var typeSel = document.getElementById('transTypeSel');
  var opacityRange = document.getElementById('transOpacityRange');
  var blurSel = document.getElementById('blurSel');

  if (typeSel) typeSel.value = type;
  if (opacityRange) opacityRange.value = opacity;
  if (blurSel) blurSel.value = blurVal;

  window.updateThemeStyle();

  var fpBlur = localStorage.getItem('theme_fp_blur_val') || 'blur(24px)';
  var fpOpacity = localStorage.getItem('theme_fp_opacity_val') || '0.6';

  var fpBlurSel = document.getElementById('fpBlurSel');
  var fpOpacityRange = document.getElementById('fpOpacityRange');

  if (fpBlurSel) fpBlurSel.value = fpBlur;
  if (fpOpacityRange) {
    fpOpacityRange.value = fpOpacity;
    document.getElementById('fpOpacityVal').textContent = Math.round(fpOpacity * 100) + '%';
  }

  document.documentElement.style.setProperty('--fp-blur-val', fpBlur);
  document.documentElement.style.setProperty('--fp-opacity-val', fpOpacity);
};

window.updateThemeBlurOnly = function(val) { document.documentElement.style.setProperty('--blur-val', val); };
window.setCardBlur = function(px) { document.documentElement.style.setProperty('--blur-val', 'blur(' + px + 'px)'); };

// ==================== 壁纸系统 (请求服务端预分类结果) ====================
window.initBg = function() {
  var screenWidth = window.screen.width || window.innerWidth;
  var screenHeight = window.screen.height || window.innerHeight;
  var isMobile = screenWidth < screenHeight;
  var orientation = isMobile ? 'vertical' : 'horizontal';
  var fallbackUrl = 'https://picsum.photos/' + (isMobile ? '1080/1920' : '1920/1080') + '?random=1';

  window.updateBgStatus('正在获取匹配设备比例的壁纸...', false);

  fetch('/local/wallpaper/list?orientation=' + orientation)
  .then(function(r) {
    if (!r.ok) throw new Error('壁纸 API 异常');
    return r.json();
  })
  .then(function(res) {
    if (res.code === 200 && res.data && res.data.length > 0) {
      // 随机抽取一张符合比例的壁纸
      var best = res.data[Math.floor(Math.random() * res.data.length)];
      var screenRatio = screenWidth / screenHeight;
      var imgRatio = best.width / best.height;
      var fitFactor = Math.max(imgRatio / screenRatio, screenRatio / imgRatio);
      
      window.setBg(best.url);
      window.updateBgStatus('✅ 已载入契合比例的壁纸: ' + best.name + ' (' + best.width + 'x' + best.height + ', 偏离值: ' + ((fitFactor - 1) * 100).toFixed(0) + '%)', false);
    } else {
      throw new Error('未找到合适的壁纸文件');
    }
  })
  .catch(function(e) {
    console.error('API 壁纸加载受阻，正在加载随机兜底图...', e);
    window.updateBgStatus('本地加载失败，已使用图床兜底壁纸', true);
    window.setBg(fallbackUrl);
  });
};

window.updateBgStatus = function(text, isError) {
  var el = document.getElementById('bgStatusText');
  if (el) {
    el.textContent = text;
    el.style.color = isError ? 'var(--primary)' : 'var(--text-secondary)';
  } else {
    console.log('[壁纸加载日志]: ' + text);
  }
};

window.changeMaskOpacity = function(val) {
  var mask = document.getElementById('bg-mask');
  if (mask) {
    mask.style.background = 'rgba(0, 0, 0, ' + val + ')';
    localStorage.setItem('theme_mask_opacity', val);
  }
};

window.setBg = function(url) {
  var overlay = document.getElementById('bg-overlay');
  if (overlay) {
    var img = new Image();
    img.src = url;
    img.onload = function() { overlay.style.backgroundImage = 'url(' + url + ')'; };
  }
};