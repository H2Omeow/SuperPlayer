// ==================== 核心 API 请求封装（XHR） ====================
window.fAPI = function(p) {
  return new Promise(function(r, j) {
    var x = new XMLHttpRequest();
    x.timeout = 12000;
    x.onload = function() { try { r(JSON.parse(x.responseText)); } catch(e) { j(e); } };
    x.onerror = function() { j(new Error('网络错误')); };
    x.ontimeout = function() { j(new Error('超时')); };
    x.open('GET', window.API + p, true);
    x.send();
  });
};

// ==================== 转义函数 ====================
window.escH = function(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
};

window.escA = function(s) {
  return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;');
};

// ==================== Toast ====================
window.toast = function(m) {
  var o = document.querySelector('.toast');
  if (o) o.remove();
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2000);
};

// ==================== API 检测（使用 fAPI 版本） ====================
window.chkAPI = function() {
  window.fAPI('/personalized?limit=1')
    .then(function(d) {
      document.getElementById('apiS').innerHTML = (d && d.code === 200)
        ? '<span class="sdot on"></span>已连接'
        : '<span class="sdot off"></span>异常';
    })
    .catch(function(e) {
      document.getElementById('apiS').innerHTML = '<span class="sdot off"></span>' + (e.message === '超时' ? '连接超时' : '未连接');
    });
};

// ==================== 时间格式化 ====================
window.fmtT = function(t) {
  if (!t || isNaN(t)) return '00:00';
  var m = Math.floor(t / 60), s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};
