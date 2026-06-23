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

  // 触发硬件加速重新绘制
  var temp = root.style.transform;
  root.style.transform = 'translateZ(0.01px)';
  root.offsetHeight;
  requestAnimationFrame(function() {
    root.style.transform = temp;
  });
};

window.changeBlur = function() {
  window.updateThemeStyle();
};

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

window.updateThemeBlurOnly = function(val) {
  document.documentElement.style.setProperty('--blur-val', val);
};

window.setCardBlur = function(px) {
  document.documentElement.style.setProperty('--blur-val', 'blur(' + px + 'px)');
};

// ==================== 壁纸系统 ====================
window.initBg = function() {
  var screenWidth = window.screen.width || window.innerWidth;
  var screenHeight = window.screen.height || window.innerHeight;
  var isMobile = screenWidth < screenHeight;
  var fallbackUrl = 'https://picsum.photos/' + (isMobile ? '1080/1920' : '1920/1080') + '?random=1';

  window.updateBgStatus('正在读取本地壁纸目录...', false);

  fetch('/data/wallpaper/')
  .then(function(r) {
    if (!r.ok) {
      throw new Error('HTTP ' + r.status + '。请确认服务器 /data/wallpaper/ 存在且已开启 autoindex。');
    }
    return r.text();
  })
  .then(function(htmlStr) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(htmlStr, "text/html");
    var links = doc.getElementsByTagName("a");

    var files = [];
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      if (href.endsWith('/') || href.includes('?') || href.includes('..')) {
        continue;
      }
      if (/\.(jpg|jpeg|png|webp|gif)$/i.test(href)) {
        var parts = href.split('/');
        var filename = decodeURIComponent(parts[parts.length - 1]);
        if (filename) {
          files.push({ name: filename });
        }
      }
    }

    if (files.length > 0) {
      window.selectAndSetBg(files, isMobile);
    } else {
      throw new Error('本地目录下未找到支持的图片文件。');
    }
  })
  .catch(function(e) {
    console.error('本地壁纸加载受阻，正在加载随机兜底图...', e);
    window.updateBgStatus('本地加载失败，已使用随机兜底壁纸', true);
    window.setBg(fallbackUrl);
  });
};

window.selectAndSetBg = function(files, isMobile) {
  var screenRatio = window.innerWidth / window.innerHeight;
  var sampleSize = Math.min(5, files.length);
  var shuffled = files.slice().sort(function() { return 0.5 - Math.random(); });
  var candidates = shuffled.slice(0, sampleSize);

  window.updateBgStatus('正在并行检测并计算 ' + sampleSize + ' 张壁纸的画面契合度...', false);

  var loadedCount = 0;
  var results = [];
  var hasApplied = false;

  candidates.forEach(function(file) {
    var imgUrl = '/data/wallpaper/' + encodeURIComponent(file.name);
    var img = new Image();
    img.src = imgUrl;

    img.onload = function() {
      if (hasApplied) return;
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var imgRatio = w / h;
      var fitFactor = Math.max(imgRatio / screenRatio, screenRatio / imgRatio);

      results.push({
        name: file.name,
        url: imgUrl,
        w: w,
        h: h,
        fitFactor: fitFactor
      });
      checkDone();
    };

    img.onerror = function() {
      if (hasApplied) return;
      checkDone();
    };
  });

  function checkDone() {
    loadedCount++;
    if (loadedCount === sampleSize && !hasApplied) {
      hasApplied = true;
      applyBestFit();
    }
  }

  function applyBestFit() {
    if (results.length > 0) {
      results.sort(function(a, b) { return a.fitFactor - b.fitFactor; });
      var best = results[0];
      window.setBg(best.url);
      window.updateBgStatus('✅ 已载入屏幕契合度最高的壁纸: ' + best.name + ' (' + best.w + 'x' + best.h + ', 画面偏离: ' + ((best.fitFactor - 1) * 100).toFixed(0) + '%)', false);
    } else {
      window.updateBgStatus('❌ 候选壁纸解析失败，已启用图床兜底', true);
      var fallbackUrl = 'https://picsum.photos/' + (isMobile ? '1080/1920' : '1920/1080') + '?random=1';
      window.setBg(fallbackUrl);
    }
  }

  setTimeout(function() {
    if (!hasApplied) {
      hasApplied = true;
      console.log('壁纸抽样预检超时，快速收网并使用当前已载入的最优图片...');
      applyBestFit();
    }
  }, 2500);
};

window.parseResolution = function(filename) {
  var m = filename.match(/(\d{3,5})[xX\*_](\d{3,5})/);
  if (m) {
    var w = parseInt(m[1]), h = parseInt(m[2]);
    if (w >= 300 && w <= 10000 && h >= 300 && h <= 10000) {
      return { w: w, h: h, ratio: w / h };
    }
  }
  return null;
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
    img.onload = function() {
      overlay.style.backgroundImage = 'url(' + url + ')';
    };
  }
};
