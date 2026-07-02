// ==================== 歌曲播放入口 ====================
window.pSongNow = function(id, nm, ar, pc) {
  var song = {id:id, nm:nm, ar:ar, pc:pc};
  if (window.list.length === 0) {
    window.list.push(song);
    if (window.playMode === 'random') window.originalList.push(song);
    window.playByIdx(0);
    return;
  }
  var existingIdx = window.list.findIndex(function(s){ return s.id === id; });
  if (existingIdx === window.idx) { window.tPlay(); return; }
  if (existingIdx !== -1) {
    window.list.splice(existingIdx, 1);
    if (existingIdx < window.idx) window.idx--;
  }
  window.list.splice(window.idx + 1, 0, song);
  
  if (window.playMode === 'random') {
    var currentId = window.list[window.idx].id;
    var oIdx = window.originalList.findIndex(function(s) { return s.id === currentId; });
    if (oIdx >= 0) window.originalList.splice(oIdx + 1, 0, song);
    else window.originalList.push(song);
  }
  window.playByIdx(window.idx + 1);
};

window.pSong = function(id, nm, ar, pc) {
  var song = {id:id, nm:nm, ar:ar, pc:pc};
  if (window.list.length === 0) {
    window.list.push(song);
    if (window.playMode === 'random') window.originalList.push(song);
    window.playByIdx(0);
  } else {
    window.list.push(song);
    if (window.playMode === 'random') window.originalList.push(song);
    window.toast('已添加到播放列表');
  }
  window.renderPL();
};

// ==================== 播放模式控制 (循环/单曲/随机) ====================
window.togglePlayMode = function() {
  var modes = ['loop', 'single', 'random'];
  var nextIdx = (modes.indexOf(window.playMode) + 1) % 3;
  window.playMode = modes[nextIdx];
  
  var icons = { 'loop': 'fa-retweet', 'single': 'fa-sync', 'random': 'fa-random' };
  var labels = { 'loop': '列表循环', 'single': '单曲循环', 'random': '随机播放' };
  
  var mBtn = document.getElementById('modeBtn');
  var fBtn = document.getElementById('fpModeBtn');
  if(mBtn) mBtn.innerHTML = '<i class="fas ' + icons[window.playMode] + '"></i>';
  if(fBtn) fBtn.innerHTML = '<i class="fas ' + icons[window.playMode] + '"></i>';
  window.toast(labels[window.playMode]);

  if (window.playMode === 'random') {
      if (window.originalList.length === 0) window.originalList = window.list.slice();
      
      if (window.list.length > 1) {
          var currentSong = window.list[window.idx];
          var remaining = window.list.filter(function(_, i) { return i !== window.idx; });
          
          // Fisher-Yates 洗牌算法打乱
          for (var i = remaining.length - 1; i > 0; i--) {
              var j = Math.floor(Math.random() * (i + 1));
              var temp = remaining[i];
              remaining[i] = remaining[j];
              remaining[j] = temp;
          }
          window.list = [currentSong].concat(remaining);
          window.idx = 0;
      }
  } else if (window.playMode === 'loop') {
      if (window.originalList.length > 0) {
          var currentSongId = window.list[window.idx] ? window.list[window.idx].id : null;
          window.list = window.originalList.slice();
          window.originalList = [];
          if (currentSongId) {
              var newIdx = window.list.findIndex(function(s) { return s.id === currentSongId; });
              if (newIdx !== -1) window.idx = newIdx;
          }
      }
  }
  window.renderPL();
};

// ==================== 定时关闭功能 ====================
window.setSleepTimer = function(mins) {
  if (window.sleepTimer) { clearTimeout(window.sleepTimer); window.sleepTimer = null; }
  document.getElementById('timerModal').classList.remove('show');
  
  if (mins === 'custom') {
      var input = prompt('请输入定时关闭的时间（分钟）：');
      if (input !== null && !isNaN(input) && input > 0) mins = parseInt(input);
      else return;
  }
  
  if (mins > 0) {
      window.toast('将在 ' + mins + ' 分钟后自动停止播放');
      window.sleepTimer = setTimeout(function() {
          var a = document.getElementById('aPlayer');
          if (!a.paused) window.tPlay();
          window.toast('⏰ 定时关闭已触发');
      }, mins * 60 * 1000);
  } else {
      window.toast('已取消定时关闭');
  }
};

// ==================== 核心播放逻辑 ====================
window.playByIdx = function(i) {
  window.idx = i;
  var s = window.list[window.idx];
  var coverUrl = s.pc || '';

  document.getElementById('pBar').style.display = 'flex';
  document.getElementById('pTtl').textContent = s.nm;
  document.getElementById('pArt').textContent = s.ar;

  if (coverUrl) {
    document.getElementById('pCvr').src = coverUrl + '?param=100y100';
    document.getElementById('fpCvr').src = coverUrl + '?param=400y400';
    document.getElementById('statusCover').src = coverUrl + '?param=100y100';
  } else {
    var ph = window.coverPlaceholder();
    document.getElementById('pCvr').src = ph;
    document.getElementById('fpCvr').src = ph;
    document.getElementById('statusCover').src = ph;
  }

  document.getElementById('fpTtl').textContent = s.nm;
  document.getElementById('fpArt').textContent = s.ar;
  document.getElementById('nowPlaying').textContent = s.nm;
  document.getElementById('statusArtist').textContent = s.ar;

  window.addToHistory(s);
  window.fLrc(s.id);
  window.updateMediaSession(s, "正在匹配歌词...");

  var q = document.getElementById('qSel').value;
  var ck = window.getNCookie();
  var brMap = { 'standard': 128000, 'higher': 192000, 'exhigh': 320000, 'lossless': 999000 };
  var backupBr = brMap[q] || 320000;

  window.fAPI('/song/url/v1?id=' + s.id + '&level=' + q + (ck ? '&cookie=' + encodeURIComponent(ck) : ''))
  .then(function(d) {
    if (d && d.code === 200 && d.data && d.data[0] && d.data[0].url) {
      window.loadAudioSrc(d.data[0].url);
    } else {
      window.tryBackupSongUrl(s.id, backupBr, ck);
    }
  })
  .catch(function() {
    window.tryBackupSongUrl(s.id, backupBr, ck);
  });
};

// ==================== 浏览器系统媒体控件对接 ====================
window.updateMediaSession = function(song, lyricText) {
  if ('mediaSession' in navigator) {
    var coverUrl = song.pc ? (song.pc + '?param=500y500') : window.coverPlaceholder();
    navigator.mediaSession.metadata = new MediaMetadata({
        title: song.nm,
        artist: song.ar,
        album: lyricText || '超级播放器',
        artwork: [{ src: coverUrl, sizes: '500x500', type: 'image/jpeg' }]
    });
    
    navigator.mediaSession.setActionHandler('play', function() { if(document.getElementById('aPlayer').paused) window.tPlay(); });
    navigator.mediaSession.setActionHandler('pause', function() { if(!document.getElementById('aPlayer').paused) window.tPlay(); });
    navigator.mediaSession.setActionHandler('previoustrack', function() { window.prev(); });
    navigator.mediaSession.setActionHandler('nexttrack', function() { window.next(); });
  }
};

window.tryBackupSongUrl = function(id, br, ck) {
  window.fAPI('/song/url?id=' + id + '&br=' + br + (ck ? '&cookie=' + encodeURIComponent(ck) : ''))
  .then(function(d) {
    if (d && d.code === 200 && d.data && d.data[0] && d.data[0].url) {
      window.loadAudioSrc(d.data[0].url);
    } else {
      window.toast('音频获取受阻 (可能为VIP或无版权歌曲)');
    }
  })
  .catch(function() {
    window.toast('音频服务异常，请稍后重试');
  });
};

window.loadAudioSrc = function(url) {
  var a = document.getElementById('aPlayer');
  if (a) {
    a.src = url;
    a.play()
    .then(function() { window.play = true; window.upIcn(); })
    .catch(function() { window.toast('请手动点击播放按钮'); });
  }
};

window.tPlay = function() {
  var a = document.getElementById('aPlayer');
  if (!a.src) return;
  if (a.paused) { a.play().catch(function(){}); window.play = true; }
  else { a.pause(); window.play = false; }
  window.upIcn();
};

window.upIcn = function() {
  var i = window.play ? 'fa-pause' : 'fa-play';
  document.getElementById('pIcn').className = 'fas ' + i;
  document.getElementById('fpIcn').className = 'fas ' + i;
  var fpCvr = document.getElementById('fpCvr');
  if (window.play) fpCvr.classList.add('playing');
  else fpCvr.classList.remove('playing');
};

window.tFull = function() {
  var fp = document.getElementById('fullP');
  fp.classList.toggle('show');
  if (fp.classList.contains('show')) document.body.classList.add('fs-mode');
  else document.body.classList.remove('fs-mode');
};

window.prev = function() { 
  if (window.idx > 0) window.playByIdx(window.idx - 1); 
  else if (window.list.length > 0) window.playByIdx(window.list.length - 1);
};

window.next = function() { 
  if (window.idx < window.list.length - 1) window.playByIdx(window.idx + 1); 
  else if (window.list.length > 0) window.playByIdx(0);
};

// ==================== 进度条拖动 ====================
window.seek = function(e) {
  if (window.seeking) { window.seeking = false; return; }
  if (e.type === 'touchstart') window.seeking = true;
  var b = e.currentTarget, r = b.getBoundingClientRect();
  var x = e.clientX != null ? e.clientX : (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX);
  if (x == null) return;
  var pct = Math.max(0, Math.min(1, (x - r.left) / r.width));
  var a = document.getElementById('aPlayer');
  if (a.duration && isFinite(a.duration)) a.currentTime = pct * a.duration;
};

// ==================== 歌词系统 ====================
window.fLrc = function(id) {
  var ul = document.getElementById('lyrUl');
  ul.innerHTML = '<li>正在寻找精准同步歌词...</li>';
  window.lyrics = [];

  window.fAPI('/lyric/new?id=' + id).then(function(d) {
    var lrc = (d.yrc && d.yrc.lyric) || (d.lrc && d.lrc.lyric) || '';
    var tlr = (d.tlyric && d.tlyric.lyric) || '';
    if (lrc) {
      window.renderParsedLrc(lrc, tlr);
    } else {
      window.tryBackupLrc(id);
    }
  })
  .catch(function() {
    window.tryBackupLrc(id);
  });
};

window.tryBackupLrc = function(id) {
  window.fAPI('/lyric?id=' + id).then(function(d) {
    var lrc = (d.lrc && d.lrc.lyric) || '';
    var tlr = (d.tlyric && d.tlyric.lyric) || '';
    if (lrc) {
      window.renderParsedLrc(lrc, tlr);
    } else {
      document.getElementById('lyrUl').innerHTML = '<li>暂无歌词</li>';
    }
  })
  .catch(function() {
    document.getElementById('lyrUl').innerHTML = '<li>歌词加载异常</li>';
  });
};

window.renderParsedLrc = function(lrc, tlr) {
  var ul = document.getElementById('lyrUl');
  if (!ul) return;
  var ma = window.pLrc(lrc), ta = window.pLrc(tlr);

  window.lyrics = ma.map(function(m) {
    var t = ta.find(function(x) { return Math.abs(x.time - m.time) < 0.5; });
    if (t) m.t = t.text;
    return m;
  });

  if (window.lyrics.length > 0) {
    ul.innerHTML = window.lyrics.map(function(l, i) {
      var txt = '';
      if (l.words) {
        txt = l.words.map(function(w) {
          return '<span class="wc" data-t="' + w.t + '" data-d="' + (w.d||0) + '"><span class="wg">' + window.escH(w.ch) + '</span><span class="wp">' + window.escH(w.ch) + '</span></span>';
        }).join('');
      } else {
        txt = window.escH(l.text);
      }
      return '<li id="l' + i + '">' + txt + (l.t ? '<span class="lt">' + window.escH(l.t) + '</span>' : '') + '</li>';
    }).join('');
  } else { ul.innerHTML = '<li>暂无歌词</li>'; }
};

window.pLrc = function(s) {
  if (!s) return [];
  var ls = s.split(String.fromCharCode(10)), r = [];
  for (var i = 0; i < ls.length; i++) {
    var l = ls[i];
    if (!l) continue;
    if (l.charAt(0) === '{') {
      try {
        var j = JSON.parse(l);
        if (j.t !== undefined && j.c) {
          var txt = j.c.map(function(x){return x.tx||''}).join('');
          if (txt) r.push({time:j.t/1000,text:txt});
        }
      } catch(e){}
      continue;
    }
    var i1 = l.indexOf('['), i2 = l.indexOf(']');
    if (i1 === -1 || i2 === -1) continue;
    var m = l.substring(i1 + 1, i2), t = l.substring(i2 + 1).trim();
    if (!t) continue;
    var words = [];
    var wRe = /\(\d+,\d+,\d+\)/g;
    var parts = t.split(wRe);
    var tsList = [];
    var tsRe2 = /\((\d+,\d+,\d+)\)/g;
    var tMa;
    while ((tMa = tsRe2.exec(t)) !== null) {
      var tp = tMa[1].split(',');
      tsList.push({t:parseInt(tp[0])/1000, d:parseInt(tp[1])/1000});
    }
    for (var ti = 0; ti < tsList.length && ti + 1 < parts.length; ti++) {
      var txt = parts[ti + 1];
      if (txt) words.push({ch:txt, t:tsList[ti].t, d:tsList[ti].d});
    }
    var plain = t.replace(wRe,'').trim();
    if (!plain) continue;
    var p = m.split(','), tm = 0;
    if (p.length === 2) tm = parseInt(p[0]) / 1000;
    else { var tp = m.split(':'); if (tp.length === 2) tm = parseInt(tp[0]) * 60 + parseFloat(tp[1]); }
    if (tm > 0 && plain) r.push({time:tm,text:plain,words:words.length > 0 ? words : null});
  }
  return r.sort(function(a,b){return a.time-b.time});
};

window.rafWords = function() {
  if (!window.lyrics.length || !window.play) { window.rafId = null; return; }
  var ct = document.getElementById('aPlayer').currentTime;
  var idx2 = -1;
  for (var j = window.lyrics.length - 1; j >= 0; j--) { if (window.lyrics[j].time <= ct) { idx2 = j; break; } }
  var li = document.getElementById('l' + (idx2 < 0 ? 0 : idx2));
  if (li) {
    var cw = li.querySelectorAll('.wc');
    for (var k = 0; k < cw.length; k++) {
      var wt = parseFloat(cw[k].getAttribute('data-t') || 0);
      var wd = parseFloat(cw[k].getAttribute('data-d') || 0);
      var p = (ct - wt) / wd;
      if (p >= 1) {
        cw[k].classList.add('done');
        cw[k].classList.remove('active');
        var po = cw[k].querySelector('.wp');
        if (po) po.style.width = '100%';
      } else if (p > 0) {
        cw[k].classList.remove('done');
        cw[k].classList.add('active');
        var pt = p * 100;
        var po2 = cw[k].querySelector('.wp');
        if (po2) po2.style.width = pt + '%';
      } else {
        cw[k].classList.remove('done','active');
        var po3 = cw[k].querySelector('.wp');
        if (po3) po3.style.width = '0%';
      }
    }
  }
  window.rafId = requestAnimationFrame(window.rafWords);
};

// ==================== 播放列表管理 ====================
window.shPL = function() { window.renderPL(); document.getElementById('plModal').classList.add('show'); };
window.hdPL = function() { document.getElementById('plModal').classList.remove('show'); };

window.flipAnim = function(container, oldRects) {
  var items = container.querySelectorAll('.pl-item');
  var anims = [];
  items.forEach(function(it) {
    var id;
    var di = it.getAttribute('data-i');
    if (di !== null) {
      id = window.list[parseInt(di)].id;
    } else {
      var dci = it.getAttribute('data-ci');
      if (dci !== null && window.activeCustomPlIdx >= 0) {
        id = window.customPlaylists[window.activeCustomPlIdx].songs[parseInt(dci)].id;
      }
    }
    if (!id || !oldRects[id]) return;
    var newRect = it.getBoundingClientRect();
    var oldRect = oldRects[id];
    var dx = oldRect.left - newRect.left;
    var dy = oldRect.top - newRect.top;
    if (dx === 0 && dy === 0) return;
    anims.push({ el: it, dx: dx, dy: dy });
  });
  if (anims.length === 0) return;

  anims.forEach(function(a) {
    a.el.style.transition = 'none';
    a.el.style.transform = 'translate(' + a.dx + 'px, ' + a.dy + 'px)';
  });

  requestAnimationFrame(function() {
    anims.forEach(function(a) {
      a.el.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1.2)';
      a.el.style.transform = '';
      var elRef = a.el;
      var onEnd = function() {
        elRef.style.transition = '';
        elRef.style.transform = '';
        elRef.removeEventListener('transitionend', onEnd);
      };
      elRef.addEventListener('transitionend', onEnd);
    });
  });
};

window.renderPL = function() {
  var el = document.getElementById('plList');
  var em = document.getElementById('plEmpty');
  if (window.list.length === 0) { el.innerHTML = ''; em.style.display = 'block'; return; }
  em.style.display = 'none';

  el.innerHTML = window.list.map(function(s, i) {
    var plCover = (s.pc || '') ? (s.pc + '?param=100y100') : window.coverPlaceholder();
    return '<div class="s-item pl-item" draggable="true" data-i="' + i + '" onclick="plClick(' + i + ')">'
      + '<span class="drag-hdl" onclick="event.stopPropagation()"><i class="fas fa-grip-lines"></i></span>'
      + '<img src="' + plCover + '" alt="" loading="lazy" onerror="imgFallback(this)" />'
      + '<div class="s-info"><div class="sn" style="' + (window.idx === i ? 'color:var(--primary)' : '') + '">' + window.escH(s.nm) + '</div><div class="sa">' + window.escH(s.ar) + '</div></div>'
      + '<span class="pl-del" onclick="event.stopPropagation();rmPL(' + i + ')" title="删除"><i class="fas fa-times"></i></span>'
      + '</div>';
  }).join('');

  var dragSrc = -1;
  el.ondragstart = function(e) {
    var item = e.target.closest('.pl-item');
    if (!item) return;
    dragSrc = parseInt(item.getAttribute('data-i'));
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragSrc));
  };
  el.ondragend = function(e) {
    el.querySelectorAll('.pl-item').forEach(function(x) { x.classList.remove('dragging','drag-over'); });
  };

  el.ondragover = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var dragged = el.querySelector('.pl-item.dragging');
    if (dragged) dragged.style.display = 'none';
    var below = document.elementFromPoint(e.clientX, e.clientY);
    if (dragged) dragged.style.display = '';
    var item = below ? below.closest('.pl-item') : null;

    el.querySelectorAll('.drag-over').forEach(function(x) { x.classList.remove('drag-over'); });
    if (item && parseInt(item.getAttribute('data-i')) !== dragSrc) {
      item.classList.add('drag-over');
    }
  };

  el.ondrop = function(e) {
    e.preventDefault();
    var item = el.querySelector('.pl-item.drag-over');
    el.querySelectorAll('.pl-item').forEach(function(x) { x.classList.remove('dragging','drag-over'); });
    if (!item || dragSrc < 0) { dragSrc = -1; return; }
    var to = parseInt(item.getAttribute('data-i'));
    if (dragSrc === to) { dragSrc = -1; return; }

    var oldRects = {};
    el.querySelectorAll('.pl-item').forEach(function(it) {
      var di = parseInt(it.getAttribute('data-i'));
      oldRects[window.list[di].id] = it.getBoundingClientRect();
    });

    var song = window.list.splice(dragSrc, 1)[0];
    window.list.splice(to, 0, song);
    if (window.idx === dragSrc) window.idx = to;
    else if (dragSrc < to && window.idx > dragSrc && window.idx <= to) window.idx--;
    else if (dragSrc > to && window.idx >= to && window.idx < dragSrc) window.idx++;
    dragSrc = -1;
    window.renderPL();

    requestAnimationFrame(function() {
      window.flipAnim(el, oldRects);
    });
  };

  var touchSrc = -1;
  el.ontouchstart = function(e) {
    var item = e.target.closest('.pl-item');
    if (!item) return;
    touchSrc = parseInt(item.getAttribute('data-i'));
  };
  el.ontouchmove = function(e) {
    if (touchSrc < 0) return;
    var items = el.querySelectorAll('.pl-item');
    el.querySelectorAll('.drag-over').forEach(function(x) { x.classList.remove('drag-over'); });
    var y = e.touches[0].clientY;
    for (var ti = 0; ti < items.length; ti++) {
      var r = items[ti].getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) { items[ti].classList.add('drag-over'); break; }
    }
  };

  el.ontouchend = function(e) {
    if (touchSrc < 0) return;
    el.querySelectorAll('.pl-item').forEach(function(x) { x.classList.remove('dragging','drag-over'); });
    var items = el.querySelectorAll('.pl-item');
    var y = e.changedTouches[0].clientY;
    var to = -1;
    for (var ti = 0; ti < items.length; ti++) {
      var r = items[ti].getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) { to = ti; break; }
    }
    if (to < 0 || touchSrc === to) { touchSrc = -1; return; }

    var oldRects = {};
    items.forEach(function(it) {
      var di = parseInt(it.getAttribute('data-i'));
      oldRects[window.list[di].id] = it.getBoundingClientRect();
    });

    var song = window.list.splice(touchSrc, 1)[0];
    window.list.splice(to, 0, song);
    if (window.idx === touchSrc) window.idx = to;
    else if (touchSrc < to && window.idx > touchSrc && window.idx <= to) window.idx--;
    else if (touchSrc > to && window.idx >= to && window.idx < touchSrc) window.idx++;
    touchSrc = -1;
    window.renderPL();

    requestAnimationFrame(function() {
      window.flipAnim(el, oldRects);
    });
  };
};

window.plClick = function(i) {
  if (window.idx === i && document.getElementById('aPlayer').src) { window.hdPL(); return; }
  window.playByIdx(i);
  window.hdPL();
};

window.rmPL = function(i) {
  if (i < 0 || i >= window.list.length) return;
  window.list.splice(i, 1);
  if (window.list.length === 0) { window.idx = -1; }
  else if (window.idx === i) {
    if (i >= window.list.length) window.idx = window.list.length - 1;
    window.playByIdx(window.idx);
  } else if (window.idx > i) { window.idx--; }
  window.renderPL();
};

// ==================== 历史记录 ====================
window.addToHistory = function(song) {
  var index = window.playHistory.findIndex(function(s){ return s.id === song.id; });
  if(index > -1) window.playHistory.splice(index, 1);
  window.playHistory.unshift(song);
  if(window.playHistory.length > 100) window.playHistory.pop();
  localStorage.setItem('my_history', JSON.stringify(window.playHistory));
};

// ==================== 收藏功能 ====================
window.isFav = function(id) {
  return window.myFavorites.some(function(s){ return s.id === id; });
};

window.favSong = function(id, nm, ar, pc, btn) {
  var index = window.myFavorites.findIndex(function(s){ return s.id === id; });
  if (index > -1) {
    window.myFavorites.splice(index, 1);
    btn.innerHTML = '<i class="far fa-heart"></i>';
    btn.querySelector('i').style.color = '';
  } else {
    window.myFavorites.push({id:id, nm:nm, ar:ar, pc:pc});
    btn.innerHTML = '<i class="fas fa-heart"></i>';
    btn.querySelector('i').style.color = 'var(--primary)';
  }
  localStorage.setItem('my_favorites', JSON.stringify(window.myFavorites));
  if(document.getElementById('mineFavorites').style.display !== 'none') {
    window.renderMineFavorites();
  }
};

// ==================== 添加到歌单 ====================
window.openAddPlModal = function(id, nm, ar, pc) {
  window.pendingAddSong = {id:id, nm:nm, ar:ar, pc:pc};
  window.renderAddPlModal();
  document.getElementById('addPlModal').classList.add('show');
};

window.renderAddPlModal = function() {
  var el = document.getElementById('addPlTargetList');
  var html = '<div class="modal-menu-item" onclick="execAddPl(-1)"><i class="fas fa-play-circle" style="color:var(--primary);margin-right:8px;"></i>当前播放列表</div>';
  html += '<div class="modal-menu-item" onclick="createNewPl()"><i class="fas fa-plus" style="margin-right:8px;"></i>新建自定义歌单...</div>';
  window.customPlaylists.forEach(function(p, i) {
    html += '<div class="modal-menu-item" onclick="execAddPl(' + i + ')"><i class="fas fa-list" style="margin-right:8px;"></i>' + window.escH(p.name) + ' <span style="opacity:0.5;font-size:12px;">(' + p.songs.length + ')</span></div>';
  });
  el.innerHTML = html;
};

window.execAddPl = function(plIdx) {
  if (!window.pendingAddSong) return;
  if (plIdx === -1) {
    window.list.push(window.pendingAddSong);
    if (window.playMode === 'random') window.originalList.push(window.pendingAddSong);
    window.toast('已加入到当前播放列表尾部');
  } else {
    if (!window.customPlaylists[plIdx].songs.some(function(s){return s.id === window.pendingAddSong.id})) {
      window.customPlaylists[plIdx].songs.push(window.pendingAddSong);
      window.saveCustomPl();
      window.toast('成功添加到 ' + window.customPlaylists[plIdx].name);
    } else {
      window.toast('歌曲已在歌单中');
    }
  }
  document.getElementById('addPlModal').classList.remove('show');
};

window.createNewPl = function() {
  var name = prompt('请输入新歌单名称:');
  if (name && name.trim()) {
    window.customPlaylists.push({id: Date.now().toString(), name: name.trim(), songs: []});
    window.saveCustomPl();
    if (window.pendingAddSong) {
      window.renderAddPlModal();
      window.execAddPl(window.customPlaylists.length - 1);
    }
  }
};

window.saveCustomPl = function() {
  localStorage.setItem('my_playlists', JSON.stringify(window.customPlaylists));
};

// ==================== 自定义歌单管理 ====================
window.openCustomPl = function(idx) {
  window.activeCustomPlIdx = idx;
  document.getElementById('cPlTitle').innerHTML = '<i class="fas fa-list" style="color:var(--primary);margin-right:8px"></i>' + window.escH(window.customPlaylists[idx].name);
  window.renderCustomPl();
  document.getElementById('customPlModal').classList.add('show');
};

window.renderCustomPl = function() {
  var el = document.getElementById('cPlList');
  if (window.activeCustomPlIdx < 0) return;
  var songs = window.customPlaylists[window.activeCustomPlIdx].songs;
  if (songs.length === 0) { el.innerHTML = '<div class="pl-empty">歌单为空，快去搜索并添加吧</div>'; return; }

  el.innerHTML = songs.map(function(s, i) {
    var cover = s.pc || '';
    var src = cover ? (cover + '?param=100y100') : window.coverPlaceholder();
    return '<div class="s-item pl-item" draggable="true" data-ci="' + i + '" onclick="playCustomPlSong(' + i + ')">'
      + '<span class="drag-hdl" onclick="event.stopPropagation()"><i class="fas fa-grip-lines"></i></span>'
      + '<img src="' + src + '" alt="" loading="lazy" onerror="imgFallback(this)" />'
      + '<div class="s-info"><div class="sn">' + window.escH(s.nm) + '</div><div class="sa">' + window.escH(s.ar) + '</div></div>'
      + '<span class="pl-del" onclick="event.stopPropagation();rmCustomPlSong(' + i + ')" title="删除"><i class="fas fa-times"></i></span>'
      + '</div>';
  }).join('');

  var dragSrc = -1;
  el.ondragstart = function(e) {
      var item = e.target.closest('.pl-item');
      if (!item) return;
      dragSrc = parseInt(item.getAttribute('data-ci'));
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragSrc));
  };
  el.ondragend = function(e) { el.querySelectorAll('.pl-item').forEach(function(x) { x.classList.remove('dragging','drag-over'); }); };

  el.ondragover = function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var dragged = el.querySelector('.pl-item.dragging');
      if (dragged) dragged.style.display = 'none';
      var below = document.elementFromPoint(e.clientX, e.clientY);
      if (dragged) dragged.style.display = '';
      var item = below ? below.closest('.pl-item') : null;

      el.querySelectorAll('.drag-over').forEach(function(x) { x.classList.remove('drag-over'); });
      if (item && parseInt(item.getAttribute('data-ci')) !== dragSrc) {
        item.classList.add('drag-over');
      }
  };

  el.ondrop = function(e) {
      e.preventDefault();
      var item = el.querySelector('.pl-item.drag-over');
      el.querySelectorAll('.pl-item').forEach(function(x) { x.classList.remove('dragging','drag-over'); });
      if (!item || dragSrc < 0) { dragSrc = -1; return; }
      var to = parseInt(item.getAttribute('data-ci'));
      if (dragSrc === to) { dragSrc = -1; return; }

      var oldRects = {};
      el.querySelectorAll('.pl-item').forEach(function(it) {
        var dci = parseInt(it.getAttribute('data-ci'));
        oldRects[songs[dci].id] = it.getBoundingClientRect();
      });

      var song = songs.splice(dragSrc, 1)[0];
      songs.splice(to, 0, song);
      window.saveCustomPl(); window.renderCustomPl(); if(document.getElementById('minePlaylists').style.display !== 'none') window.renderMinePlaylists();

      requestAnimationFrame(function() {
        window.flipAnim(el, oldRects);
      });
  };

  var touchSrc = -1;
  el.ontouchstart = function(e) {
      var item = e.target.closest('.pl-item');
      if (!item) return;
      touchSrc = parseInt(item.getAttribute('data-ci'));
  };
  el.ontouchmove = function(e) {
      if (touchSrc < 0) return;
      var items = el.querySelectorAll('.pl-item');
      el.querySelectorAll('.drag-over').forEach(function(x) { x.classList.remove('drag-over'); });
      var y = e.touches[0].clientY;
      for (var ti = 0; ti < items.length; ti++) {
        var r = items[ti].getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) { items[ti].classList.add('drag-over'); break; }
      }
  };
  el.ontouchend = function(e) {
      if (touchSrc < 0) return;
      el.querySelectorAll('.pl-item').forEach(function(x) { x.classList.remove('dragging','drag-over'); });
      var items = el.querySelectorAll('.pl-item');
      var y = e.changedTouches[0].clientY;
      var to = -1;
      for (var ti = 0; ti < items.length; ti++) {
        var r = items[ti].getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) { to = ti; break; }
      }
      if (to < 0 || touchSrc === to) { touchSrc = -1; return; }

      var oldRects = {};
      items.forEach(function(it) {
        var dci = parseInt(it.getAttribute('data-ci'));
        oldRects[songs[dci].id] = it.getBoundingClientRect();
      });

      var song = songs.splice(touchSrc, 1)[0];
      songs.splice(to, 0, song);
      window.saveCustomPl(); window.renderCustomPl(); if(document.getElementById('minePlaylists').style.display !== 'none') window.renderMinePlaylists();

      requestAnimationFrame(function() {
        window.flipAnim(el, oldRects);
      });
      touchSrc = -1;
  };
};

window.playCustomPlSong = function(i) {
  if (window.activeCustomPlIdx < 0) return;
  var song = window.customPlaylists[window.activeCustomPlIdx].songs[i];
  if (song) {
    window.list.push(song);
    window.playByIdx(window.list.length - 1);
    document.getElementById('customPlModal').classList.remove('show');
  }
};

window.rmCustomPlSong = function(i) {
  if (window.activeCustomPlIdx < 0) return;
  window.customPlaylists[window.activeCustomPlIdx].songs.splice(i, 1);
  window.saveCustomPl();
  window.renderCustomPl();
  if (document.getElementById('minePlaylists').style.display !== 'none') window.renderMinePlaylists();
};

// ==================== 卡片折叠 ====================
window.toggleCollapse = function(header) {
  var card = header.closest('.collapsible-card');
  if (!card) return;
  card.classList.toggle('collapsed');
};

// ==================== 音频事件绑定 ====================
(function() {
  var ae = document.getElementById('aPlayer');
  if (!ae) return;

  ae.addEventListener('timeupdate', function() {
    if (!this.duration) return;
    var pct = this.duration ? (this.currentTime / this.duration * 100) : 0;
    document.getElementById('prgF').style.width = pct + '%';
    document.getElementById('fpPrg').style.width = pct + '%';
    document.getElementById('curT').textContent = window.fmtT(this.currentTime);
    document.getElementById('durT').textContent = window.fmtT(this.duration);
    document.getElementById('fpDur').textContent = window.fmtT(this.duration);
    document.getElementById('fpCurT').textContent = window.fmtT(this.currentTime);
    
    if (!window.lyrics.length) return;
    var idx2 = -1;
    for (var j = window.lyrics.length - 1; j >= 0; j--) { if (window.lyrics[j].time <= this.currentTime) { idx2 = j; break; } }
    var target = idx2 < 0 ? 0 : idx2;
    var li = document.getElementById('l' + target);
    
    if (li) {
      if (li.getAttribute('data-active') !== '1') {
        document.querySelectorAll('#lyrUl li').forEach(function(el) { el.classList.remove('active'); el.removeAttribute('data-active'); });
        li.classList.add('active');
        li.setAttribute('data-active', '1');
        li.scrollIntoView({ block: 'center', behavior: 'smooth' });
        
        // 动态向通知栏输出实时歌词 (仅在行发生改变时同步，防高频卡死)
        if (window.lastLyricIdx !== target && window.list[window.idx]) {
            window.lastLyricIdx = target;
            var lyricText = window.lyrics[target].text;
            window.updateMediaSession(window.list[window.idx], lyricText);
        }
      }
    }
  });

  ae.addEventListener('play', function() {
    window.play = true; window.upIcn();
    if (window.rafId) cancelAnimationFrame(window.rafId);
    window.rafId = requestAnimationFrame(window.rafWords);
    var icon = document.getElementById('statusPlayIcon');
    if (icon) icon.innerHTML = '<i class="fas fa-pause"></i>';
  });

  ae.addEventListener('pause', function() {
    window.play = false; window.upIcn();
    if (window.rafId) { cancelAnimationFrame(window.rafId); window.rafId = null; }
    var icon = document.getElementById('statusPlayIcon');
    if (icon) icon.innerHTML = '<i class="fas fa-play"></i>';
  });

  ae.addEventListener('ended', function() {
    window.play = false; window.upIcn();
    if (window.rafId) { cancelAnimationFrame(window.rafId); window.rafId = null; }
    
    if (window.playMode === 'single') {
        this.currentTime = 0;
        this.play();
    } else {
        // 如果是随机模式且已经播放到整个列表的结尾，重新打乱列表并自动循环续播
        if (window.playMode === 'random' && window.idx >= window.list.length - 1 && window.list.length > 1) {
            var currentSong = window.list[window.idx];
            var remaining = window.list.filter(function(_, i) { return i !== window.idx; });
            for (var i = remaining.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = remaining[i];
                remaining[i] = remaining[j];
                remaining[j] = temp;
            }
            window.list = [currentSong].concat(remaining);
            window.idx = 0; // 重置游标
            window.renderPL(); // 更新洗牌后的 UI
        }
        window.next();
    }
  });
})();


// ==================== 环形高保真音频可视化视觉引擎 ====================
// 1. 定义全局默认配置
window.visSettings = {
  theme: 'netease',
  amp: 1.8,       
  smooth: 0.75,   
  bars: 76        
};

// 从 localStorage 读取保存的配置
(function() {
  try {
    var saved = localStorage.getItem('visSettings');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed) {
        // 使用本地数据覆盖默认数据
        window.visSettings = Object.assign({}, window.visSettings, parsed);
      }
    }
  } catch (e) {
    console.error('读取本地频谱配置失败:', e);
  }
})();

// 将当前的配置同步到 HTML UI 控件上
window.syncVisSettingsToUI = function() {
  var tSel = document.getElementById('visThemeSel');
  var aRng = document.getElementById('visAmpRange');
  var sRng = document.getElementById('visSmoothRange');
  var bRng = document.getElementById('visBarsRange');
  
  if (tSel && window.visSettings.theme) tSel.value = window.visSettings.theme;
  if (aRng) { aRng.value = window.visSettings.amp; var el = document.getElementById('visAmpVal'); if(el) el.textContent = aRng.value + 'x'; }
  if (sRng) { sRng.value = window.visSettings.smooth; var el = document.getElementById('visSmoothVal'); if(el) el.textContent = sRng.value; }
  if (bRng) { bRng.value = window.visSettings.bars; var el = document.getElementById('visBarsVal'); if(el) el.textContent = bRng.value + '根'; }
};

// 当用户拖动滑块或改变选择时：读取 UI 值并保存到本地
window.updateVisSettings = function() {
  var tSel = document.getElementById('visThemeSel');
  var aRng = document.getElementById('visAmpRange');
  var sRng = document.getElementById('visSmoothRange');
  var bRng = document.getElementById('visBarsRange');
  
  if(tSel) window.visSettings.theme = tSel.value;
  if(aRng) { window.visSettings.amp = parseFloat(aRng.value); var el = document.getElementById('visAmpVal'); if(el) el.textContent = aRng.value + 'x'; }
  if(sRng) { window.visSettings.smooth = parseFloat(sRng.value); var el = document.getElementById('visSmoothVal'); if(el) el.textContent = sRng.value; }
  if(bRng) { window.visSettings.bars = parseInt(bRng.value); var el = document.getElementById('visBarsVal'); if(el) el.textContent = bRng.value + '根'; }
  
  // 写入本地存储
  try {
    localStorage.setItem('visSettings', JSON.stringify(window.visSettings));
  } catch(e) {
    console.error('保存频谱配置失败:', e);
  }
  
  // 如果音频分析器已启动，实时更新平滑度
  if (window._analyserNode) {
    window._analyserNode.smoothingTimeConstant = window.visSettings.smooth;
  }
};

// 重置参数并清空本地存储
window.resetVisPreset = function() {
  window.visSettings = {
    theme: 'netease',
    amp: 1.8,
    smooth: 0.75,
    bars: 76
  };
  try {
    localStorage.setItem('visSettings', JSON.stringify(window.visSettings));
  } catch(e) {}
  
  // 同步更新 UI 状态
  window.syncVisSettingsToUI();
  
  if (window._analyserNode) {
    window._analyserNode.smoothingTimeConstant = window.visSettings.smooth;
  }
  window.toast('已重置频谱参数');
};

// 2. 视觉引擎主逻辑
(function() {
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let source = null;
  let isInitialized = false;
  
  let spectrumRotation = 0; 
  let fixedRadius = 110;    

  function initVisualizer() {
    if (isInitialized) return;

    const ae = document.getElementById('aPlayer');
    const canvas = document.getElementById('visualizerCanvas');
    if (!ae || !canvas) return;

    const ctx = canvas.getContext('2d');

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; 
      analyser.smoothingTimeConstant = window.visSettings.smooth; 
      
      window._analyserNode = analyser; 
      
      source = audioContext.createMediaElementSource(ae);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    } catch (e) {
      console.error('Web Audio API 初始化失败:', e);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    isInitialized = true;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;

      const img = document.getElementById('fpCvr');
      if (img) {
        const imgRect = img.getBoundingClientRect();
        fixedRadius = (imgRect.width / 2) * window.devicePixelRatio;
      } else {
        fixedRadius = canvas.width / 4;
      }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function draw() {
      requestAnimationFrame(draw);

      if (!window.play) { 
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.max(0, dataArray[i] - 7); 
        }
      } else {
        analyser.getByteFrequencyData(dataArray);
        spectrumRotation += 0.003; 
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = fixedRadius; 

      const usefulBars = window.visSettings.bars; 
      const step = Math.PI / (usefulBars - 1);
      const maxBarHeight = radius * 0.45; 

      let bassSum = 0;
      for (let k = 0; k < 4; k++) bassSum += dataArray[k];
      let bassPulse = (bassSum / 4) / 255; 

      for (let i = 0; i < usefulBars; i++) {
        let t = i / (usefulBars - 1);
        
        let logIndex = Math.floor(Math.pow(t, 1.4) * 88);
        logIndex = Math.min(90, Math.max(0, logIndex));

        let sum = 0;
        let count = 0;
        for (let j = -2; j <= 2; j++) {
          let tIdx = logIndex + j;
          if (tIdx >= 0 && tIdx < bufferLength) {
            sum += dataArray[tIdx];
            count++;
          }
        }
        let smoothedValue = count > 0 ? sum / count : 0;
        let intensity = Math.pow(smoothedValue / 255, 1.3);

        let finalHeight = (intensity * 0.88 + bassPulse * 0.12) * maxBarHeight * window.visSettings.amp;
        finalHeight = Math.max(2.5 * window.devicePixelRatio, finalHeight);

        const angleRight = (Math.PI / 2) - (i * step) + spectrumRotation;
        const angleLeft = (Math.PI / 2) + (i * step) + spectrumRotation;

        function drawBar(angle) {
          const startX = centerX + Math.cos(angle) * radius;
          const startY = centerY + Math.sin(angle) * radius;
          const endX = centerX + Math.cos(angle) * (radius + finalHeight);
          const endY = centerY + Math.sin(angle) * (radius + finalHeight);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          
          ctx.lineWidth = 3.2 * window.devicePixelRatio; 
          ctx.lineCap = 'round'; 

          let hue, lightness;
          const theme = window.visSettings.theme;
          if (theme === 'netease') {
             hue = 345 - (t * 135); 
             lightness = 55 + (intensity * 15);
             ctx.strokeStyle = `hsl(${hue}, 90%, ${lightness}%)`;
          } else if (theme === 'cyber') {
             hue = 280 + (t * 60); 
             lightness = 60 + (intensity * 20);
             ctx.strokeStyle = `hsl(${hue}, 100%, ${lightness}%)`;
          } else if (theme === 'gold') {
             hue = 45 + (t * 15); 
             lightness = 40 + (intensity * 35);
             ctx.strokeStyle = `hsl(${hue}, 95%, ${lightness}%)`;
          } else if (theme === 'neon') {
             hue = 150 + (t * 70); 
             lightness = 50 + (intensity * 25);
             ctx.strokeStyle = `hsl(${hue}, 100%, ${lightness}%)`;
          }

          ctx.stroke();
        }

        drawBar(angleRight);
        drawBar(angleLeft);
      }
    }

    draw();
  }

  window.addEventListener('DOMContentLoaded', () => {
    // 页面加载完成后，立刻将读取到的本地数据同步应用到 HTML 控件中
    window.syncVisSettingsToUI(); 

    const ae = document.getElementById('aPlayer');
    if (ae) {
      ae.addEventListener('play', () => {
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume();
        }
        initVisualizer();
      });
    }
  });
})();