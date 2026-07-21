// ==================== 全局通用组件 ====================
window.toast = function(msg) {
  var div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = 'position:fixed; bottom:120px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 20px; border-radius:20px; font-size:13px; z-index:9999; opacity:0; transition:opacity 0.3s; pointer-events:none;';
  document.body.appendChild(div);
  requestAnimationFrame(function(){ div.style.opacity = '1'; });
  setTimeout(function() {
    div.style.opacity = '0';
    setTimeout(function(){ if (div.parentNode) div.parentNode.removeChild(div); }, 300);
  }, 2500);
};

window.showSleepTimerModal = function() {
  document.getElementById('timerModal').classList.add('show');
};

// ==================== 搜索类型切换 ====================
window.setSType = function(t, btn) {
  window.sType = t;
  document.querySelectorAll(".s-tabs button").forEach(function(b) { b.classList.remove("active"); });
  btn.classList.add("active");
  var labels = {1:"搜索歌曲...",100:"搜索歌手...",10:"搜索专辑..."};
  document.getElementById("sIpt").placeholder = labels[t] || "搜索...";
};

// ==================== 自动获取游客Cookie ====================
window.initGuestCookie = function() {
  if (!localStorage.getItem(window.ncKey) && !localStorage.getItem(window.ncGuestKey)) {
    window.fAPI('/register/anonimous').then(function(d) {
      if (d.code === 200&& d.cookie) localStorage.setItem(window.ncGuestKey, d.cookie);
    }).catch(function(){});
  }
};

// ==================== Cookie 管理 ====================
window.loadCookies = function() {
  var nc = localStorage.getItem(window.ncKey) || '';
  var bl = localStorage.getItem(window.blKey) || '';
  if (document.getElementById('ncCookie')) document.getElementById('ncCookie').value = nc;
  if (document.getElementById('blCookie')) document.getElementById('blCookie').value = bl;
  if (nc) document.getElementById('ncSaved').style.display = 'inline';
  if (bl) document.getElementById('blSaved').style.display = 'inline';
};

window.saveCookie = function(type) {
  var ipt = type === 'nc' ? document.getElementById('ncCookie') : document.getElementById('blCookie');
  var saved = type === 'nc' ? document.getElementById('ncSaved') : document.getElementById('blSaved');
  var key = type === 'nc' ? window.ncKey : window.blKey;
  if (ipt) {
    localStorage.setItem(key, ipt.value);
    saved.style.display = ipt.value ? 'inline' : 'none';
  }
};

window.getNCookie = function() { return localStorage.getItem(window.ncKey) || localStorage.getItem(window.ncGuestKey) || ''; };
window.getBCookie = function() { return localStorage.getItem(window.blKey) || ''; };

// ==================== 扫码登录 ====================
window.qrLogin = function() {
  var modal = document.getElementById('qrModal');
  var img = document.getElementById('qrImg');
  var msg = document.getElementById('qrMsg');
  modal.classList.add('show');
  img.src = ''; msg.textContent = '正在获取二维码...';
  window.fAPI('/login/qr/key?timestamp=' + Date.now()).then(function(d) {
    if (d.code === 200 && d.data && d.data.unikey) {
      var key = d.data.unikey;
      msg.textContent = '正在生成二维码...';
      window.fAPI('/login/qr/create?key=' + key + '&qrimg=true&timestamp=' + Date.now()).then(function(qd) {
        if (qd.code === 200 && qd.data && qd.data.qrimg) {
          img.src = qd.data.qrimg;
          msg.textContent = '请使用网易云音乐 App 扫码';
          window.pollQR(key);
        } else msg.textContent = '二维码生成失败';
      }).catch(function() { msg.textContent = '二维码生成失败，请检查 API'; });
    } else msg.textContent = '获取二维码失败，请重试';
  }).catch(function() { msg.textContent = '获取二维码失败，请检查 API'; });
};

window.pollQR = function(key) {
  if (window.qrTimer) clearTimeout(window.qrTimer);
  window.fAPI('/login/qr/check?key=' + key + '&timestamp=' + Date.now()).then(function(d) {
    if (d.code === 803) {
      var cookie = d.cookie || '';
      document.getElementById('ncCookie').value = cookie;
      localStorage.setItem(window.ncKey, cookie);
      document.getElementById('ncSaved').style.display = 'inline';
      document.getElementById('qrMsg').textContent = '登录成功！Cookie 已保存';
      setTimeout(function() { document.getElementById('qrModal').classList.remove('show'); }, 1500);
    } else if (d.code === 802) {
      document.getElementById('qrMsg').textContent = '已扫码，确认登录中...';
      window.qrTimer = setTimeout(function() { window.pollQR(key); }, 1500);
    } else if (d.code === 801) {
      document.getElementById('qrMsg').textContent = '请使用网易云音乐 App 扫码';
      window.qrTimer = setTimeout(function() { window.pollQR(key); }, 2000);
    } else if (d.code === 800) {
      document.getElementById('qrMsg').textContent = '二维码已过期，请重新获取';
    } else {
      window.qrTimer = setTimeout(function() { window.pollQR(key); }, 2000);
    }
  }).catch(function() { window.qrTimer = setTimeout(function() { window.pollQR(key); }, 3000); });
};

window.closeQR = function() {
  if (window.qrTimer) { clearTimeout(window.qrTimer); window.qrTimer = null; }
  document.getElementById('qrModal').classList.remove('show');
};

// ==================== 页面导航记录 ====================
window.pageOrder = ['home', 'music', 'mine', 'bilibili'];
window.currentPage = 'home';

// ==================== 导航高亮滑动指示器引擎 ====================
window.updateNavIndicator = function(v) {
  document.querySelectorAll('[data-v="' + v + '"]').forEach(function(btn) {
    var parent = btn.parentElement;
    if (!parent) return;
    if (window.getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    parent.style.setProperty('--ind-t', btn.offsetTop + 'px');
    parent.style.setProperty('--ind-l', btn.offsetLeft + 'px');
    parent.style.setProperty('--ind-w', btn.offsetWidth + 'px');
    parent.style.setProperty('--ind-h', btn.offsetHeight + 'px');
    if (!parent.classList.contains('has-ind')) parent.classList.add('has-ind');
  });
};

window.addEventListener('resize', function() { if (window.currentPage) window.updateNavIndicator(window.currentPage); });
setTimeout(function() { if (window.currentPage) window.updateNavIndicator(window.currentPage); }, 150);

// ==================== 核心页面切换 ====================
window.sw = function(v) {
  var oldPage = window.currentPage;
  var oldIdx = window.pageOrder.indexOf(oldPage);
  var newIdx = window.pageOrder.indexOf(v);
  if (oldIdx === newIdx) return;
  var isForward = newIdx > oldIdx;

  var oldEl = document.getElementById('pg' + oldPage.charAt(0).toUpperCase() + oldPage.slice(1));
  var newEl = document.getElementById('pg' + v.charAt(0).toUpperCase() + v.slice(1));

  document.querySelectorAll('[data-v]').forEach(function(e) { e.classList.remove('active'); });
  document.querySelectorAll('[data-v="' + v + '"]').forEach(function(e) { e.classList.add('active'); });

  window.updateNavIndicator(v);

  var pgTitle = document.getElementById('pgTitle');
  if (pgTitle) pgTitle.textContent = {home:'主页', music:'网易云音乐', bilibili:'哔哩哔哩', mine:'我的'}[v] || '主页';

  if (oldEl) {
    oldEl.classList.add('animating');
    oldEl.classList.remove('active', 'slide-left', 'slide-right');
    oldEl.classList.add(isForward ? 'slide-left' : 'slide-right');
    clearTimeout(oldEl.swTimer);
    oldEl.swTimer = setTimeout(function() {
      if (!oldEl.classList.contains('active')) oldEl.classList.remove('animating', 'slide-left', 'slide-right');
    }, 420);
  }

  if (newEl) {
    newEl.classList.add('animating');
    newEl.style.transition = 'none';
    newEl.classList.remove('active', 'slide-left', 'slide-right');
    newEl.classList.add(isForward ? 'slide-right' : 'slide-left');
    void newEl.offsetWidth;
    newEl.style.transition = '';
    newEl.classList.remove('slide-left', 'slide-right');
    newEl.classList.add('active');
    clearTimeout(newEl.swTimer);
    newEl.swTimer = setTimeout(function() { newEl.classList.remove('animating'); }, 420);
  }

  window.currentPage = v;

  if (v === 'music') window.loadRec();
  if (v === 'bilibili') window.loadBili();
  if (v === 'mine') window.setMineTab('history', document.querySelector('#mineTabs button'));
};

// ==================== 更新日志 ====================
window.logs = [
  {d:'2026-07-18',t:'新增：画中画歌词悬浮窗开关与频谱显示开关，主页新增音频缓存管理卡片。'},
  {d:'2026-07-18',t:'修复：音乐卡片 HTML嵌套错误及"我的"页面三个选项卡无法加载的问题。'},
  {d:'2026-07-03',t:'新增：环形动态音频频谱功能，支持自定义频谱颜色、跳动幅度、平滑度及线条数量。'},
  {d:'2026-06-26',t:'在全屏播放器上增加了独立的浏览器全屏按钮。'},
  {d:'2026-06-26',t:'更改随机壁纸获取逻辑，提前在服务端进行计算，提高壁纸获取速率。'},
  {d:'2026-06-26',t:'新增：音乐定时关闭睡眠模式、单曲循环/随机播放模式控制切换机制。'},
  {d:'2026-06-26',t:'新增：接入 MediaSession 系统媒体控件API，支持手机状态栏切歌及实时动态歌词展示。'},
  {d:'2026-06-24',t:'添加大量过渡动画，提升网站整体观感'},
  {d:'2026-06-23',t:'使用vite进行标准化重构，未播放音乐时为主页播放器状态添加图片占位符'},
  {d:'2026-06-22',t:'全体系大更新：新增游客自动认证（防错误）、自定义多层歌单系统、我的界面历史记录；卡片可分离式一键秒插播及收藏。'},
  {d:'2026-06-20',t:'全屏纯净穿透：全屏模式下屏蔽背景组件，直达壁纸；同时开放全屏界面的独立模糊效果与透明度参数调节。'},
  {d:'2026-06-20',t:'自适应最优比例裁剪：彻底重构壁纸轮询体系，后端预检计算尺寸抽样下发。'}
];

window.shCL = function() {
  document.getElementById('clList').innerHTML = window.logs.map(function(i) {
    return '<div class="li"><div class="ld">' + i.d + '</div><div class="lt">' + i.t + '</div></div>';
  }).join('');
  document.getElementById('clModal').classList.add('show');
};

window.hdCL = function() { document.getElementById('clModal').classList.remove('show'); };

// ==================== 歌曲卡片渲染（修复：补全.s-item闭合标签） ====================
window.buildSongCardHtml = function(s) {
  var sid = s.id, nm = s.nm, ar = s.ar, pc = s.pc || '';
  var imgSrc = pc ? (pc + '?param=100y100') : window.coverPlaceholder();
  return '<div class="s-item">'
    + '<div style="display:flex;flex:1;min-width:0;align-items:center;gap:12px;" onclick="pSongNow(' + sid + ',\'' + window.escA(nm) + '\',\'' + window.escA(ar) + '\',\'' + window.escA(pc) + '\')">'
    + '<img src="' + imgSrc + '" alt="" loading="lazy" onerror="imgFallback(this)" />'
    + '<div class="s-info"><div class="sn">' + window.escH(nm) + '</div><div class="sa">' + window.escH(ar) + '</div></div>'
    + '<div class="s-actions" onclick="event.stopPropagation();">'
    + '<button class="s-action-btn" onclick="favSong(' + sid + ',\'' + window.escA(nm) + '\',\'' + window.escA(ar) + '\',\'' + window.escA(pc) + '\', this)" title="收藏"><i class="' + (window.isFav(sid) ? 'fas' : 'far') + ' fa-heart" style="color:' + (window.isFav(sid) ? 'var(--primary)' : '') + '"></i></button>'
    + '<button class="s-action-btn" onclick="openAddPlModal(' + sid + ',\'' + window.escA(nm) + '\',\'' + window.escA(ar) + '\',\'' + window.escA(pc) + '\')" title="添加到播放列表"><i class="fas fa-plus"></i></button>'
    + '</div>'
    + '</div>';
};

// ==================== "我的"页面选项卡 ====================
window.setMineTab = function(tab, btn) {
  document.querySelectorAll('#mineTabs button').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.getElementById('mineHistory').style.display = 'none';
  document.getElementById('mineFavorites').style.display = 'none';
  document.getElementById('minePlaylists').style.display = 'none';

  if (tab === 'history') {
    document.getElementById('mineHistory').style.display = 'flex';
    window.renderMineHistory();
  } else if (tab === 'favorites') {
    document.getElementById('mineFavorites').style.display = 'flex';
    window.renderMineFavorites();
  } else if (tab === 'playlists') {
    document.getElementById('minePlaylists').style.display = 'flex';
    window.renderMinePlaylists();
  }
};

// ==================== 我的 - 播放历史 ====================
window.renderMineHistory = function() {
  var el = document.getElementById('mineHistory');
  if (!el) return;
  if (!window.playHistory || window.playHistory.length === 0) {
    el.innerHTML = '<div class="pl-empty">暂无播放历史</div>';
    return;
  }
  el.innerHTML = window.playHistory.map(function(s) {
    return window.buildSongCardHtml(s);
  }).join('');
};

// ==================== 我的 - 收藏歌曲 ====================
window.renderMineFavorites = function() {
  var el = document.getElementById('mineFavorites');
  if (!el) return;
  if (!window.myFavorites || window.myFavorites.length === 0) {
    el.innerHTML = '<div class="pl-empty">暂无收藏歌曲，快去收藏喜欢的歌吧</div>';
    return;
  }
  el.innerHTML = window.myFavorites.map(function(s) {
    return window.buildSongCardHtml(s);
  }).join('');
};

// ==================== 我的 - 自定义歌单列表 ====================
window.renderMinePlaylists = function() {
  var el = document.getElementById('minePlaylists');
  if (!el) return;
  if (!window.customPlaylists || window.customPlaylists.length === 0) {
    el.innerHTML = '<div class="pl-empty">暂无自定义歌单，去搜索页添加歌曲吧</div>';
    return;
  }
  el.innerHTML = window.customPlaylists.map(function(p, i) {
    return '<div class="s-item">'
      + '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;" onclick="openCustomPl(' + i + ')">'
      + '<div style="width:44px;height:44px;border-radius:10px;background:rgba(243,18,96,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      + '<i class="fas fa-list" style="color:var(--primary);font-size:18px;"></i></div>'
      + '<div class="s-info"><div class="sn">' + window.escH(p.name) + '</div>'
      + '<div class="sa">' + p.songs.length + ' 首歌曲</div></div>'
      + '</div>'
      + '<div class="s-actions" onclick="event.stopPropagation();">'
      + '<button class="s-action-btn" onclick="deleteCustomPl(' + i + ')" title="删除歌单"><i class="fas fa-trash" style="color:#f87171;"></i></button>'
      + '</div>'
      + '</div>';
  }).join('');
};

// ==================== 删除自定义歌单 ====================
window.deleteCustomPl = function(i) {
  if (!window.customPlaylists || !window.customPlaylists[i]) return;
  if (!confirm('确认删除歌单「' + window.customPlaylists[i].name + '」？此操作不可恢复。')) return;
  window.customPlaylists.splice(i, 1);
  window.saveCustomPl();
  window.renderMinePlaylists();
};

// ==================== 播放器控制按钮注入（画中画 & 频谱开关） ====================
function injectPlayerButtons() {
  //---- 全屏播放器按钮区----
  var fpModeBtn = document.getElementById('fpModeBtn');
  if (fpModeBtn && fpModeBtn.parentElement) {
    // 画中画歌词按钮
    if (!document.getElementById('fpPipLyricsBtn')) {
      var fpPipBtn = document.createElement('button');
      fpPipBtn.id = 'fpPipLyricsBtn';
      fpPipBtn.className = fpModeBtn.className;
      fpPipBtn.title = '歌词悬浮窗（画中画）';
      fpPipBtn.innerHTML = '<i class="fas fa-tv"></i>';
      fpPipBtn.addEventListener('click', function() {
        if (typeof window.toggleLyricsPiP === 'function') window.toggleLyricsPiP();
      });
      fpModeBtn.parentElement.insertBefore(fpPipBtn, fpModeBtn.nextSibling);
    }
    // 频谱开关按钮
    if (!document.getElementById('fpVisToggleBtn')) {
      var fpVisBtn = document.createElement('button');
      fpVisBtn.id = 'fpVisToggleBtn';
      fpVisBtn.className = fpModeBtn.className;
      var visOn = window.visEnabled !== false;
      fpVisBtn.title = visOn ? '关闭频谱' : '开启频谱';
      fpVisBtn.style.color = visOn ? 'var(--primary)' : '';
      fpVisBtn.innerHTML = '<i class="fas fa-wave-square"></i>';
      fpVisBtn.addEventListener('click', function() {
        if (typeof window.toggleVis === 'function') window.toggleVis();
      });
      fpModeBtn.parentElement.insertBefore(fpVisBtn, fpModeBtn.nextSibling);
    }
  }

  // ---- 迷你播放器按钮区 ----
  var modeBtn = document.getElementById('modeBtn');
  if (modeBtn && modeBtn.parentElement) {
    // 画中画歌词按钮
    if (!document.getElementById('pipLyricsBtn')) {
      var pipBtn = document.createElement('button');
      pipBtn.id = 'pipLyricsBtn';
      pipBtn.className = modeBtn.className;
      pipBtn.title = '歌词悬浮窗（画中画）';
      pipBtn.innerHTML = '<i class="fas fa-tv"></i>';
      pipBtn.addEventListener('click', function() {
        if (typeof window.toggleLyricsPiP === 'function') window.toggleLyricsPiP();
      });
      modeBtn.parentElement.insertBefore(pipBtn, modeBtn.nextSibling);
    }
    // 频谱开关按钮
    if (!document.getElementById('visToggleBtn')) {
      var visBtn = document.createElement('button');
      visBtn.id = 'visToggleBtn';
      visBtn.className = modeBtn.className;
      var visOnMini = window.visEnabled !== false;
      visBtn.title = visOnMini ? '关闭频谱' : '开启频谱';
      visBtn.style.color = visOnMini ? 'var(--primary)' : '';
      visBtn.innerHTML = '<i class="fas fa-wave-square"></i>';
      visBtn.addEventListener('click', function() {
        if (typeof window.toggleVis === 'function') window.toggleVis();
      });
      modeBtn.parentElement.insertBefore(visBtn, modeBtn.nextSibling);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPlayerButtons);
} else {
  injectPlayerButtons();
}
