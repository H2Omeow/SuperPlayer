/*
 * 保存浏览器原生 Fetch。
 *
 * feature-fixes.js 会临时包装 window.fetch。音乐播放、缓存和下载使用
 * 网易云直链时需要绕过该包装，避免不必要地转发到服务器音频代理。
 */
if (!window.__directFetch) {
  window.__directFetch = window.fetch.bind(window);
}
