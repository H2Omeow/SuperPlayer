// ==================== 全局状态变量 ====================

// API 端点
window.API = '/api';
window.BAPI = 'http://nekoh2o.top:3002';

// Cookie 存储键名
window.ncKey = 'napcat_nc_cookie';
window.blKey = 'napcat_bl_cookie';
window.ncGuestKey = 'nc_guest_cookie';

// 播放器状态
window.lyrics = [];
window.play = false;
window.seeking = false;
window.list = [];
window.idx = -1;
window.sType = 1;

// "我的"页面数据
window.playHistory = JSON.parse(localStorage.getItem('my_history') || '[]');
window.myFavorites = JSON.parse(localStorage.getItem('my_favorites') || '[]');
window.customPlaylists = JSON.parse(localStorage.getItem('my_playlists') || '[]');

// 定时器引用
window.qrTimer = null;
window.sugDelayTimer = null;
window.rafId = null;

// 歌单添加模态框暂存
window.pendingAddSong = null;
window.activeCustomPlIdx = -1;
