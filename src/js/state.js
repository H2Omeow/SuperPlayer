// src/js/state.js
// ==================== 全局状态变量 ====================
window.API = '/api';
window.BAPI = 'http://nekoh2o.top:3002';
window.USERAPI = '/user';    // 加密播放数据（走 4096 后端）
window.currentUser = null;

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

// 播放模式 (loop: 列表循环, single: 单曲循环, random: 随机)
window.playMode = 'loop';
window.originalList = []; // 备份打乱前的原始播放列表
window.sleepTimer = null; // 定时关闭定时器
window.lastLyricIdx = -1; // 记录当前系统通知栏显示的歌词行，防止高频刷爆原生API

window.playHistory = JSON.parse(localStorage.getItem('my_history') || '[]');
window.myFavorites = JSON.parse(localStorage.getItem('my_favorites') || '[]');
window.customPlaylists = JSON.parse(localStorage.getItem('my_playlists') || '[]');

window.qrTimer = null;
window.sugDelayTimer = null;
window.rafId = null;

window.pendingAddSong = null;
window.activeCustomPlIdx = -1;
