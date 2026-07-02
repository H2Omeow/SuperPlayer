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

// ==================== 自动获取游客 Cookie ====================
window.initGuestCookie = function() {
  if (!localStorage.getItem(window.ncKey) && !localStorage.getItem(window.ncGuestKey)) {
    window.fAPI('/register/anonimous').then(function(d) {
      if (d.code === 200 && d.cookie) localStorage.setItem(window.ncGuestKey, d.cookie);
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
  {d:'2026-07-03',t:'新增：环形动态音频频谱功能，支持自定义频谱颜色、跳动幅度、平滑度及线条数量。'},
  {d:'2026-06-26',t:'在全屏播放器上增加了独立的浏览器全屏按钮。'},
  {d:'2026-06-26',t:'更改随机壁纸获取逻辑，提前在服务端进行计算，提高壁纸获取速率。'},
  {d:'2026-06-26',t:'新增：音乐定时关闭睡眠模式、单曲循环/随机播放模式控制切换机制。'},
  {d:'2026-06-26',t:'新增：接入 MediaSession 系统媒体控件 API，支持手机状态栏切歌及实时动态歌词展示。'},
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

// ==================== 歌曲卡片渲染 ====================
window.buildSongCardHtml = function(s) {
  var sid = s.id, nm = s.nm, ar = s.ar, pc = s.pc || '';
  var imgSrc = pc ? (pc + '?param=100y100') : window.coverPlaceholder();
  return '<div class="s-item">'
    + '<div style="display:flex;flex:1;min-width:0;align-items:center;gap:12px;" onclick="pSongNow(' + sid + ',\'' + window.escA(nm) + '\',\'' + window.escA(ar) + '\',\'' + window.escA(pc) + '\')">'
    + '<img src="' + imgSrc + '" alt="" loading="lazy" onerror="imgFallback(this)" />'
    + '<div class="s-info"><div class="sn">' + window.escH(nm) + '</div><div class="sa">' + window.escH(ar) + '</div></div>'
    + '</div>'
    + '<div class="s-actions" onclick="event.stopPropagation();">'
      + '<button class="s-action-btn" onclick="favSong(' + sid + ',\'' + window.escA(nm) + '\',\'' + window.escA(ar) + '\',\'' + window.escA(pc) + '\', this)" title="收藏"><i class="' + (window.isFav(sid) ? 'fas' : 'far') + ' fa-heart" style="color:' + (window.isFav(sid) ? 'var(--primary)' : '') + '"></i></button>'
      + '<button class="s-action-btn" onclick="openAddPlModal(' + sid + ',\'' + window.escA(nm) + '\',\'' + window.escA(ar) + '\',\'' + window.escA(pc) + '\')" title="添加到播放列表"><i class="fas fa-plus"></i></button>'
    + '</div>'
    + '</div>';
};

// ==================== "我的"页面选项卡 ====================
window.setMineTab = function(tab, btn) {
  document.querySelectorAll('#mineTabs button').forEach(function(b){b.classList.remove('active')});
  if(btn) btn.classList.add('active');
  document.getElementById('mineHistory').style.display = 'none';
  document.getElementById('mineFavorites').style.display = 'none';
  document.getElementById('minePlaylists').style.display = 'none';

  if(tab === 'history') {
      document.getElementById('mineHistory').style.display = 'flex';
      window.renderMineHistory();
  } else if(tab === 'favorites') {
      document.getElementById('mineFavorites').style.display = 'flex';
      window.renderMineFavorites();
  } else if(tab === 'playlists') {
      document.getElementById('minePlaylists').style.display = 'flex';
      window.renderMinePlaylists();
  }
};

window.renderMineHistory = function() {
  if(window.playHistory.length === 0) {
      document.getElementById('mineHistory').innerHTML = '<div class="empty"><i class="fas fa-history"></i><div class="t">暂无播放记录</div></div>';
      return;
  }
  document.getElementById('mineHistory').innerHTML = window.playHistory.map(function(s) { return window.buildSongCardHtml(s); }).join('');
};

window.renderMineFavorites = function() {
  if(window.myFavorites.length === 0) {
      document.getElementById('mineFavorites').innerHTML = '<div class="empty"><i class="fas fa-heart"></i><div class="t">暂无收藏</div></div>';
      return;
  }
  document.getElementById('mineFavorites').innerHTML = window.myFavorites.map(function(s) { return window.buildSongCardHtml(s); }).join('');
};

window.renderMinePlaylists = function() {
  if(window.customPlaylists.length === 0) {
      document.getElementById('minePlaylists').innerHTML = '<div class="empty"><i class="fas fa-list"></i><div class="t">暂无自定义歌单</div><button class="btn" style="margin-top:14px" onclick="createNewPl()">创建歌单</button></div>';
      return;
  }
  var ph = window.coverPlaceholder();
  var html = '<button class="btn btn-o" style="margin-bottom: 10px; width: max-content;" onclick="createNewPl()"><i class="fas fa-plus"></i> 新建歌单</button>';
  html += window.customPlaylists.map(function(p, i) {
      var cover = (p.songs.length > 0 && p.songs[0].pc) ? (p.songs[0].pc + '?param=100y100') : ph;
      return '<div class="s-item" onclick="openCustomPl(' + i + ')">'
           + '<img src="' + cover + '" onerror="imgFallback(this)" />'
           + '<div class="s-info"><div class="sn">' + window.escH(p.name) + '</div><div class="sa">' + p.songs.length + ' 首歌曲</div></div>'
           + '<button class="s-action-btn" onclick="event.stopPropagation(); deleteCustomPl(' + i + ')"><i class="fas fa-trash"></i></button>'
           + '</div>';
  }).join('');
  document.getElementById('minePlaylists').innerHTML = html;
};

window.deleteCustomPl = function(i) {
  if(confirm('确定要删除歌单 [' + window.customPlaylists[i].name + '] 吗？')) {
      window.customPlaylists.splice(i, 1);
      window.saveCustomPl();
      window.renderMinePlaylists();
  }
};

// ==================== 全局通用组件补充 (修复弹窗层级) ====================
// 强制动态注入超高层级 CSS 规则，确保弹窗在全屏播放器上层
(function() {
  var s = document.createElement('style');
  s.innerHTML = '.modal { z-index: 99999 !important; }';
  document.head.appendChild(s);
})();

// ==================== 设备级沉浸式全屏逻辑 ====================
window.toggleNativeFs = function() {
  var elem = document.documentElement;
  if (!document.fullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(function(){ window.toast('浏览器拦截了全屏请求，请手动展开'); });
    } else if (elem.webkitRequestFullscreen) { /* Safari 兼容 */
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 兼容 */
      elem.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
};

// 监听设备的真实全屏状态，同步更改图标
document.addEventListener('fullscreenchange', function() {
  var icon = document.getElementById('nativeFsIcon');
  if (icon) {
    icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
  }
});