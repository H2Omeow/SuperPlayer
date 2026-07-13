// ==================== SSO 登录 / 数据同步 ====================
window.currentUser = null;

// 直接写死前缀，避免依赖 state.js 的全局变量赋值时机
var AUTH_BASE = '/auth';
var USER_BASE = '/user';
var ACCOUNT_CENTER = 'https://account.nekoh2o.top';

// 发起登录：直接跳中心，回调用 location.origin 拼（player.nekoh2o.top，已在白名单）
window.ssoLogin = function() {
  var cb = location.origin + '/auth/sso/callback';
  location.href = ACCOUNT_CENTER + '/login?redirect=' + encodeURIComponent(cb);
};

// 退出：先清本站会话，再跳中心退出
window.ssoLogout = function() {
  fetch(AUTH_BASE + '/sso/logout', { method: 'POST', credentials: 'include' })
    .catch(function(){})
    .then(function() {
      location.href = ACCOUNT_CENTER + '/logout?redirect=' + encodeURIComponent(location.origin + '/');
    });
};

window.fetchMe = function() {
  return fetch(AUTH_BASE + '/sso/me', { credentials: 'include' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) { return (d && d.code === 0) ? d.user : null; })
    .catch(function() { return null; });
};

window.pullUserData = function() {
  return fetch(USER_BASE + '/data', { credentials: 'include' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) { return (d && d.code === 0) ? d.data : null; })
    .catch(function() { return null; });
};

// 防抖上行同步
window.syncTimer = null;
window.pushUserData = function() {
  if (!window.currentUser) return;
  if (window.syncTimer) clearTimeout(window.syncTimer);
  window.syncTimer = setTimeout(function() {
    fetch(USER_BASE + '/data', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: window.playHistory,
        favorites: window.myFavorites,
        playlists: window.customPlaylists
      })
    }).catch(function(){});
  }, 1500);
};

// 按 id 取并集（远端优先，保留本地独有）
window.mergeById = function(local, remote) {
  var seen = {}, result = [];
  (remote || []).forEach(function(s) { if (s && s.id != null && !seen[s.id]) { seen[s.id] = 1; result.push(s); } });
  (local || []).forEach(function(s) { if (s && s.id != null && !seen[s.id]) { seen[s.id] = 1; result.push(s); } });
  return result;
};

window.mergePlaylists = function(local, remote) {
  var map = {}, result = [];
  (remote || []).forEach(function(p) { if (p && p.id != null) { map[p.id] = p; result.push(p); } });
  (local || []).forEach(function(p) {
    if (!p || p.id == null) return;
    if (!map[p.id]) { map[p.id] = p; result.push(p); }
    else { map[p.id].songs = window.mergeById(p.songs, map[p.id].songs); }
  });
  return result;
};

// ==================== 用户卡片渲染 ====================
window.renderUserCard = function() {
  var card = document.getElementById('userCard');
  if (!card) return;
  var u = window.currentUser;
  if (!u) {
    card.innerHTML =
      '<i class="fas fa-user-circle" style="font-size:52px;color:var(--text-secondary);opacity:0.8;"></i>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:18px;font-weight:bold;color:var(--text-main);">未登录用户</div>'
      + '<div style="font-size:12px;color:var(--text-secondary);margin-top:5px;">登录以同步多端数据及云端歌单</div>'
      + '</div>'
      + '<button class="btn btn-o" onclick="ssoLogin()">前往登录</button>';
    return;
  }
  var name = u.nickname || u.username || '用户';
  var avatar = u.avatar || window.coverPlaceholder();
  card.innerHTML =
    '<img src="' + avatar + '" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex:none;" onerror="imgFallback(this)" />'
    + '<div style="flex:1;min-width:0;">'
    + '<div style="font-size:18px;font-weight:bold;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window.escH(name) + '</div>'
    + '<div style="font-size:11px;color:var(--text-secondary);opacity:0.55;margin-top:3px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">ID: ' + window.escH(u.id) + '</div>'
    + (u.bio ? '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window.escH(u.bio) + '</div>' : '')
    + '</div>'
    + '<button class="btn btn-o" onclick="ssoLogout()" style="flex:none;">退出登录</button>';
};

// ==================== 启动初始化 ====================
window.initAuth = function() {
  window.renderUserCard(); // 先渲染未登录态
  window.fetchMe().then(function(u) {
    if (!u) return;
    window.currentUser = u;
    window.renderUserCard();
    window.pullUserData().then(function(remote) {
      if (remote) {
        window.playHistory = window.mergeById(window.playHistory, remote.history).slice(0, 100);
        window.myFavorites = window.mergeById(window.myFavorites, remote.favorites);
        window.customPlaylists = window.mergePlaylists(window.customPlaylists, remote.playlists);
        localStorage.setItem('my_history', JSON.stringify(window.playHistory));
        localStorage.setItem('my_favorites', JSON.stringify(window.myFavorites));
        localStorage.setItem('my_playlists', JSON.stringify(window.customPlaylists));
      }
      window.pushUserData(); // 合并结果回写
      if (window.currentPage === 'mine') {
        var btn = document.querySelector('#mineTabs button');
        window.setMineTab('history', btn);
      }
    });
  });
};
