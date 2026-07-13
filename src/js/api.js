// ==================== 搜索建议 ====================
window.fetchSug = function() {
  var q = document.getElementById("sIpt").value.trim();
  var drop = document.getElementById("sDrop");
  if (q.length < 2) { drop.classList.remove("show"); return; }
  window.fAPI("/search/suggest?keywords=" + encodeURIComponent(q)).then(function(d) {
    if (d.code === 200 && d.result) {
      var items = [];
      if (d.result.songs) d.result.songs.slice(0, 6).forEach(function(s) { items.push(s.name); });
      if (d.result.artists) d.result.artists.slice(0, 3).forEach(function(a) { items.push(a.name); });
      if (d.result.albums) d.result.albums.slice(0, 3).forEach(function(a) { items.push(a.name); });
      if (items.length > 0) {
        drop.innerHTML = items.map(function(nm) {
          return "<div class=\"si\" onclick=\"fillSug('" + window.escA(nm) + "')\">" + window.escH(nm) + "</div>";
        }).join("");
        drop.classList.add("show");
      } else { drop.classList.remove("show"); }
    } else { drop.classList.remove("show"); }
  }).catch(function() { document.getElementById("sDrop").classList.remove("show"); });
};

window.sugDelay = function() {
  if (window.sugDelayTimer) clearTimeout(window.sugDelayTimer);
  window.sugDelayTimer = setTimeout(window.fetchSug, 300);
};

window.fillSug = function(q) {
  document.getElementById("sIpt").value = q;
  document.getElementById("sDrop").classList.remove("show");
  window.sBtn();
};

window.hideSug = function() { document.getElementById("sDrop").classList.remove("show"); };

// ==================== 哔哩哔哩 ====================
window.loadBili = function() {
  var grid = document.getElementById("biGrid");
  fetch(window.BAPI + "/hot").then(function(r) { return r.json(); }).then(function(d) {
    if (d.code === 0 && d.data && d.data.list) {
      grid.innerHTML = d.data.list.map(function(v) {
        var pic = v.pic || "";
        var title = v.title || "";
        var uname = v.owner ? v.owner.name : "";
        var play = v.stat ? (v.stat.view || 0) : 0;
        return "<div class=\"sc\" onclick=\"window.open('https://www.bilibili.com/video/' + v.bvid)\"><img src=\"" + (pic ? (pic + "@200w_200h.webp") : window.coverPlaceholder()) + "\" alt=\"\" loading=\"lazy\" onerror=\"imgFallback(this)\" /><div class=\"sn\">" + window.escH(title) + "</div><div class=\"sa\">" + window.escH(uname) + " · " + window.fmtPlay(play) + "</div></div>";
      }).join("");
    } else { grid.innerHTML = "<div style=\"padding:16px;color:var(--text-secondary)\">加载失败</div>"; }
  }).catch(function() { grid.innerHTML = "<div style=\"padding:16px;color:var(--text-secondary)\">API 连接失败</div>"; });
};

window.fmtPlay = function(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n;
};

window.biSearch = function() {
  var q = document.getElementById("biIpt").value.trim();
  if (!q) return;
  document.getElementById("biRecSec").style.display = "none";
  document.getElementById("biRes").style.display = "block";
  document.getElementById("biResGrid").innerHTML = "<div class=\"spin\" style=\"margin:16px\"></div>";
  fetch(window.BAPI + "/search?keyword=" + encodeURIComponent(q) + "&p=1").then(function(r) { return r.json(); }).then(function(d) {
    if (d.code === 0 && d.data && d.data.result) {
      var videos = null;
      for (var i = 0; i < d.data.result.length; i++) {
        if (d.data.result[i].result_type === "video") {
          videos = d.data.result[i].data;
          break;
        }
      }
      if (videos && videos.length > 0) {
        document.getElementById("biCnt").textContent = "共 " + videos.length + " 个视频";
        document.getElementById("biResGrid").innerHTML = videos.map(function(v) {
          var pic = v.pic || "";
          var title = v.title || "";
          var uname = v.author || "";
          var play = v.play || 0;
          return "<div class=\"sc\" onclick=\"window.open('https://www.bilibili.com/video/' + v.bvid)\"><img src=\"" + (pic ? (pic + "@200w_200h.webp") : window.coverPlaceholder()) + "\" alt=\"\" loading=\"lazy\" onerror=\"imgFallback(this)\" /><div class=\"sn\">" + window.escH(title) + "</div><div class=\"sa\">" + window.escH(uname) + " · " + window.fmtPlay(play) + "</div></div>";
        }).join("");
      } else { document.getElementById("biResGrid").innerHTML = "<div style=\"padding:16px;color:var(--text-secondary)\">未找到视频</div>"; }
    } else { document.getElementById("biResGrid").innerHTML = "<div style=\"padding:16px;color:var(--text-secondary)\">搜索失败</div>"; }
  }).catch(function() { document.getElementById("biResGrid").innerHTML = "<div style=\"padding:16px;color:var(--text-secondary)\">搜索失败</div>"; });
};

// ==================== 推荐与搜索 ====================
window.loadRec = function() {
  var rg = document.getElementById('recGrid'), pr = document.getElementById('plRow');

  window.fAPI('/personalized?limit=8').then(function(d) {
    if (d.code === 200 && d.result) {
      pr.innerHTML = d.result.map(function(p) {
        var pic = p.picUrl || '';
        var src = pic ? (pic + '?param=200y200') : window.coverPlaceholder();
        return '<div class="plc" onclick="ldPL(\'' + p.id + '\')"><img src="' + src + '" alt="" loading="lazy" onerror="imgFallback(this)" /><div class="pn">' + window.escH(p.name) + '</div></div>';
      }).join('');
    } else {
      pr.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">无法加载推荐歌单</div>';
    }
  }).catch(function() {
    pr.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">API 连接失败</div>';
  });

  window.fAPI('/recommend/songs').then(function(d) {
    if (d.code === 200 && d.data && d.data.dailySongs) {
      window.rSong(d.data.dailySongs.slice(0,20),'recGrid');
    } else {
      window.fAPI('/top/song?type=0&limit=20').then(function(t) {
        if(t.code === 200 && t.data) window.rSong(t.data,'recGrid');
        else rg.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">无推荐数据</div>';
      }).catch(function() {
        rg.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">API 连接失败</div>';
      });
    }
  }).catch(function() {
    rg.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">API 连接失败</div>';
  });
};

// ==================== 搜索：无限滚动分页 ====================
window.SEARCH_LIMIT = 30;
window.searchState = { kw: '', offset: 0, loading: false, hasMore: true };
window.searchObserver = null;

// 保证哨兵元素与"加载更多"指示器存在，并绑定 IntersectionObserver
window.ensureSearchSentinel = function() {
  var sRes = document.getElementById('sRes');
  if (!sRes) return;

  var loading = document.getElementById('searchMoreLoading');
  if (!loading) {
    loading = document.createElement('div');
    loading.id = 'searchMoreLoading';
    loading.style.cssText = 'display:none;justify-content:center;padding:16px;';
    loading.innerHTML = '<div class="spin"></div>';
    sRes.appendChild(loading);
  }

  var sentinel = document.getElementById('searchSentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'searchSentinel';
    sentinel.style.cssText = 'height:1px;width:100%;';
    sRes.appendChild(sentinel);
  } else {
    // 移到末尾，确保始终在列表底部
    sRes.appendChild(sentinel);
  }

  if (window.searchObserver) window.searchObserver.disconnect();
  window.searchObserver = new IntersectionObserver(function(entries) {
    if (entries[0] && entries[0].isIntersecting) {
      window.loadSearchPage(false);
    }
  }, { rootMargin: '200px' });
  window.searchObserver.observe(sentinel);
};

window.showSearchMoreLoading = function(show) {
  var el = document.getElementById('searchMoreLoading');
  if (el) el.style.display = show ? 'flex' : 'none';
};

// 停止分页监听（切到歌单等场景时调用）
window.stopSearchPaging = function() {
  if (window.searchObserver) { window.searchObserver.disconnect(); window.searchObserver = null; }
  window.showSearchMoreLoading(false);
  var sentinel = document.getElementById('searchSentinel');
  if (sentinel) sentinel.style.display = 'none';
};

window.sBtn = function() {
  var q = document.getElementById('sIpt').value.trim();
  if (!q) return;
  document.getElementById('recSec').style.display = 'none';
  document.getElementById('sRes').style.display = 'block';
  document.getElementById('resCnt').textContent = '';
  document.getElementById('resGrid').innerHTML = '<div class="spin" style="margin:16px"></div>';

  window.searchState = { kw: q, offset: 0, loading: false, hasMore: true };
  var sentinel = document.getElementById('searchSentinel');
  if (sentinel) sentinel.style.display = '';
  window.ensureSearchSentinel();
  window.loadSearchPage(true);
};

// 加载一页搜索结果。isFirst=true 时替换列表，否则追加
window.loadSearchPage = function(isFirst) {
  var st = window.searchState;
  if (!st.kw || st.loading || !st.hasMore) return;
  st.loading = true;
  if (!isFirst) window.showSearchMoreLoading(true);

  var grid = document.getElementById('resGrid');

  window.fAPI('/search?keywords=' + encodeURIComponent(st.kw) + '&limit=' + window.SEARCH_LIMIT + '&offset=' + st.offset)
    .then(function(d) {
      if (d.code === 200 && d.result && d.result.songs && d.result.songs.length > 0) {
        var s = d.result.songs;
        if (s.length < window.SEARCH_LIMIT) st.hasMore = false;
        st.offset += s.length;
        var ids = s.map(function(x) { return x.id; }).join(',');
        // 拿完整详情（封面等），失败则用基础数据兜底
        return window.fAPI('/song/detail?ids=' + ids).then(function(dd) {
          var list = (dd.code === 200 && dd.songs) ? dd.songs : s;
          window.appendSong(list, 'resGrid', isFirst);
        }).catch(function() {
          window.appendSong(s, 'resGrid', isFirst);
        });
      } else {
        st.hasMore = false;
        if (isFirst) {
          grid.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">未找到结果</div>';
        }
      }
    })
    .catch(function() {
      if (isFirst) {
        grid.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">搜索失败</div>';
      }
    })
    .then(function() {
      st.loading = false;
      window.showSearchMoreLoading(false);
      if (!st.hasMore) window.stopSearchPaging();
    });
};

window.ldPL = function(id) {
  document.getElementById('recSec').style.display = 'none';
  document.getElementById('sRes').style.display = 'block';
  document.getElementById('resCnt').textContent = '';
  document.getElementById('resGrid').innerHTML = '<div class="spin" style="margin:16px"></div>';
  // 歌单是一次性加载，关掉搜索分页监听避免误触发翻页
  window.searchState = { kw: '', offset: 0, loading: false, hasMore: false };
  window.stopSearchPaging();
  window.fAPI('/playlist/detail?id=' + id).then(function(d) {
    if (d.code === 200 && d.playlist && d.playlist.tracks) {
      var s = d.playlist.tracks.slice(0, 30);
      window.rSong(s, 'resGrid');
    }
  }).catch(function() { document.getElementById('resGrid').innerHTML = '<div style="padding:16px;color:var(--text-secondary)">加载失败</div>'; });
};

// ==================== 歌曲渲染 ====================
// 把歌曲数组转成卡片 HTML（供替换与追加复用）
window.buildSongItemsHtml = function(songs) {
  return songs.map(function(s) {
    var sid = s.id || '', nm = s.name || '未知';
    var ar = (s.ar&&s.ar[0]) ? (s.ar[0].name||'未知') : (s.artists&&s.artists[0]) ? (s.artists[0].name||'未知') : '未知';
    var pc = (s.al&&s.al.picUrl) ? s.al.picUrl : '';
    if (!pc && s.album) pc = s.album.picUrl || (s.album.artist && s.album.artist.img1v1Url) || '';
    if (!pc) pc = (s.artists&&s.artists[0]&&s.artists[0].img1v1Url) ? s.artists[0].img1v1Url : '';
    return window.buildSongCardHtml({id: sid, nm: nm, ar: ar, pc: pc});
  }).join('');
};

window.rSong = function(songs, cid) {
  document.getElementById(cid).innerHTML = window.buildSongItemsHtml(songs);
};

// 追加（replace=true 时替换，用于每次搜索的第一页）
window.appendSong = function(songs, cid, replace) {
  var el = document.getElementById(cid);
  var html = window.buildSongItemsHtml(songs);
  if (replace) el.innerHTML = html;
  else el.insertAdjacentHTML('beforeend', html);
};
