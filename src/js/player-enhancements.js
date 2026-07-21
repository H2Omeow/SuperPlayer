(function() {
  'use strict';

  var PIP_PREFERENCE_KEY = 'player_pip_lyrics_enabled';
  var VISIBILITY_KEY = 'player_visualizer_enabled';
  var DOWNLOAD_TIMEOUT = 120000;

  function readBooleanPreference(key, defaultValue) {
    try {
      var value = localStorage.getItem(key);

      if (value === null) return defaultValue;

      return value === 'true';
    } catch (error) {
      return defaultValue;
    }
  }

  function writeBooleanPreference(key, value) {
    try {
      localStorage.setItem(key, value ? 'true' : 'false');
    } catch (error) {
      console.warn('[播放器设置] 无法保存设置：', error);
    }
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function escapeInlineArgument(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/</g, '\\x3c')
      .replace(/>/g, '\\x3e');
  }

  function safeSongId(value) {
    return String(value == null ? '' : value).replace(/[^\d]/g, '');
  }

  function normalizeArtist(song) {
    if (!song) return '未知歌手';

    if (typeof song.ar === 'string' && song.ar.trim()) {
      return song.ar;
    }

    if (Array.isArray(song.ar)) {
      var arNames = song.ar.map(function(artist) {
        return artist && artist.name ? artist.name : '';
      }).filter(Boolean);

      if (arNames.length > 0) return arNames.join(' / ');
    }

    if (Array.isArray(song.artists)) {
      var artistNames = song.artists.map(function(artist) {
        return artist && artist.name ? artist.name : '';
      }).filter(Boolean);

      if (artistNames.length > 0) return artistNames.join(' / ');
    }

    if (song.artist && song.artist.name) {
      return song.artist.name;
    }

    return '未知歌手';
  }

  function normalizeCover(song) {
    if (!song) return '';

    if (typeof song.pc === 'string' && song.pc) return song.pc;
    if (typeof song.picUrl === 'string' && song.picUrl) return song.picUrl;

    if (song.al && song.al.picUrl) return song.al.picUrl;
    if (song.album && song.album.picUrl) return song.album.picUrl;

    if (
      song.album &&
      song.album.artist &&
      song.album.artist.img1v1Url
    ) {
      return song.album.artist.img1v1Url;
    }

    if (
      Array.isArray(song.artists) &&
      song.artists[0] &&
      song.artists[0].img1v1Url
    ) {
      return song.artists[0].img1v1Url;
    }

    return '';
  }

  function normalizeSong(song) {
    song = song || {};

    return {
      id: song.id,
      nm: song.nm || song.name || '未知歌曲',
      ar: normalizeArtist(song),
      pc: normalizeCover(song)
    };
  }

  function normalizeSongList(list) {
    if (!Array.isArray(list)) return [];

    return list.filter(function(song) {
      return song && song.id != null;
    }).map(normalizeSong);
  }

  function persistNormalizedCollections() {
    try {
      localStorage.setItem(
        'my_history',
        JSON.stringify(window.playHistory || [])
      );

      localStorage.setItem(
        'my_favorites',
        JSON.stringify(window.myFavorites || [])
      );

      localStorage.setItem(
        'my_playlists',
        JSON.stringify(window.customPlaylists || [])
      );
    } catch (error) {
      console.warn('[我的音乐] 本地数据写入失败：', error);
    }
  }

  function normalizeStoredCollections() {
    window.playHistory = normalizeSongList(window.playHistory);
    window.myFavorites = normalizeSongList(window.myFavorites);

    if (!Array.isArray(window.customPlaylists)) {
      window.customPlaylists = [];
    }

    window.customPlaylists = window.customPlaylists
      .filter(function(playlist) {
        return playlist && playlist.id != null;
      })
      .map(function(playlist) {
        return {
          id: playlist.id,
          name: playlist.name || '未命名歌单',
          songs: normalizeSongList(playlist.songs)
        };
      });

    persistNormalizedCollections();
  }

  // ==================== 修复音乐卡片 ====================

  window.buildSongCardHtml = function(rawSong) {
    var song = normalizeSong(rawSong);
    var sid = safeSongId(song.id);

    if (!sid) return '';

    var name = escapeInlineArgument(song.nm);
    var artist = escapeInlineArgument(song.ar);
    var cover = escapeInlineArgument(song.pc);
    var imageSource = song.pc
      ? song.pc + '?param=100y100'
      : window.coverPlaceholder();

    var favorite = typeof window.isFav === 'function'
      ? window.isFav(song.id)
      : false;

    return (
      '<div class="s-item" data-song-id="' + sid + '">' +
        '<div class="song-card-main" ' +
          'onclick="pSongNow(' +
            sid +
            ',\'' +
            name +
            '\',\'' +
            artist +
            '\',\'' +
            cover +
          '\')">' +
          '<img src="' +
            window.escH(imageSource) +
            '" alt="" loading="lazy" onerror="imgFallback(this)" />' +
          '<div class="s-info">' +
            '<div class="sn">' + window.escH(song.nm) + '</div>' +
            '<div class="sa">' + window.escH(song.ar) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="s-actions" onclick="event.stopPropagation();">' +
          '<button type="button" class="s-action-btn" ' +
            'onclick="favSong(' +
              sid +
              ',\'' +
              name +
              '\',\'' +
              artist +
              '\',\'' +
              cover +
              '\',this)" title="收藏">' +
            '<i class="' +
              (favorite ? 'fas' : 'far') +
              ' fa-heart"' +
              (favorite
                ? ' style="color:var(--primary)"'
                : '') +
            '></i>' +
          '</button>' +
          '<button type="button" class="s-action-btn" ' +
            'onclick="openAddPlModal(' +
              sid +
              ',\'' +
              name +
              '\',\'' +
              artist +
              '\',\'' +
              cover +
            '\')" title="添加到播放列表">' +
            '<i class="fas fa-plus"></i>' +
          '</button>' +
          '<button type="button" class="s-action-btn song-download-btn" ' +
            'onclick="downloadSong(' +
              sid +
              ',\'' +
              name +
              '\',\'' +
              artist +
              '\',this)" title="下载歌曲">' +
            '<i class="fas fa-download"></i>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  };

  window.buildSongItemsHtml = function(songs) {
    return normalizeSongList(songs).map(function(song) {
      return window.buildSongCardHtml(song);
    }).join('');
  };

  window.rSong = function(songs, containerId) {
    var element = getElement(containerId);

    if (!element) return;

    element.innerHTML = window.buildSongItemsHtml(songs);
  };

  window.appendSong = function(songs, containerId, replace) {
    var element = getElement(containerId);

    if (!element) return;

    var html = window.buildSongItemsHtml(songs);

    if (replace) {
      element.innerHTML = html;
    } else {
      element.insertAdjacentHTML('beforeend', html);
    }
  };

  // ==================== 修复“我的”页面 ====================

  window.renderMineHistory = function() {
    var element = getElement('mineHistory');

    if (!element) return;

    window.playHistory = normalizeSongList(window.playHistory);

    if (window.playHistory.length === 0) {
      element.innerHTML =
        '<div class="pl-empty">暂无播放历史</div>';
      return;
    }

    element.innerHTML = window.playHistory.map(function(song) {
      return window.buildSongCardHtml(song);
    }).join('');
  };

  window.renderMineFavorites = function() {
    var element = getElement('mineFavorites');

    if (!element) return;

    window.myFavorites = normalizeSongList(window.myFavorites);

    if (window.myFavorites.length === 0) {
      element.innerHTML =
        '<div class="pl-empty">暂无收藏歌曲，快去收藏喜欢的歌吧</div>';
      return;
    }

    element.innerHTML = window.myFavorites.map(function(song) {
      return window.buildSongCardHtml(song);
    }).join('');
  };

  window.renderMinePlaylists = function() {
    var element = getElement('minePlaylists');

    if (!element) return;

    if (!Array.isArray(window.customPlaylists)) {
      window.customPlaylists = [];
    }

    if (window.customPlaylists.length === 0) {
      element.innerHTML =
        '<div class="pl-empty">暂无自定义歌单，去搜索页添加歌曲吧</div>';
      return;
    }

    element.innerHTML = window.customPlaylists.map(function(playlist, index) {
      var songs = Array.isArray(playlist.songs)
        ? playlist.songs
        : [];

      var name = playlist.name || '未命名歌单';

      return (
        '<div class="s-item custom-playlist-card">' +
          '<div class="song-card-main" onclick="openCustomPl(' +
            index +
          ')">' +
            '<div class="custom-playlist-icon">' +
              '<i class="fas fa-list"></i>' +
            '</div>' +
            '<div class="s-info">' +
              '<div class="sn">' + window.escH(name) + '</div>' +
              '<div class="sa">' + songs.length + ' 首歌曲</div>' +
            '</div>' +
          '</div>' +
          '<div class="s-actions" onclick="event.stopPropagation();">' +
            '<button type="button" class="s-action-btn" ' +
              'onclick="deleteCustomPl(' +
                index +
              ')" title="删除歌单">' +
              '<i class="fas fa-trash" style="color:#f87171"></i>' +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  };

  window.setMineTab = function(tab, button) {
    var validTabs = ['history', 'favorites', 'playlists'];

    if (validTabs.indexOf(tab) === -1) {
      tab = 'history';
    }

    window.currentMineTab = tab;

    document.querySelectorAll('#mineTabs button').forEach(function(item) {
      item.classList.remove('active');
    });

    if (!button) {
      var buttonIndex = validTabs.indexOf(tab);
      button = document.querySelectorAll('#mineTabs button')[buttonIndex];
    }

    if (button) button.classList.add('active');

    var history = getElement('mineHistory');
    var favorites = getElement('mineFavorites');
    var playlists = getElement('minePlaylists');

    if (history) history.style.display = 'none';
    if (favorites) favorites.style.display = 'none';
    if (playlists) playlists.style.display = 'none';

    if (tab === 'history') {
      if (history) history.style.display = 'flex';
      window.renderMineHistory();
    } else if (tab === 'favorites') {
      if (favorites) favorites.style.display = 'flex';
      window.renderMineFavorites();
    } else {
      if (playlists) playlists.style.display = 'flex';
      window.renderMinePlaylists();
    }
  };

  function refreshCurrentMineTab() {
    if (window.currentPage !== 'mine') return;

    var tab = window.currentMineTab || 'history';
    window.setMineTab(tab);
  }

  var originalAddToHistory = window.addToHistory;

  if (typeof originalAddToHistory === 'function') {
    window.addToHistory = function(song) {
      originalAddToHistory(normalizeSong(song));

      if (
        window.currentPage === 'mine' &&
        (window.currentMineTab || 'history') === 'history'
      ) {
        window.renderMineHistory();
      }
    };
  }

  var originalSaveCustomPl = window.saveCustomPl;

  if (typeof originalSaveCustomPl === 'function') {
    window.saveCustomPl = function() {
      normalizeStoredCollections();
      originalSaveCustomPl();

      if (
        window.currentPage === 'mine' &&
        window.currentMineTab === 'playlists'
      ) {
        window.renderMinePlaylists();
      }
    };
  }

  // ==================== 歌曲下载 ====================

  function getSelectedQuality() {
    var qualitySelect = getElement('qSel');

    return qualitySelect ? qualitySelect.value : 'exhigh';
  }

  function getBitrateForQuality(quality) {
    var bitrates = {
      standard: 128000,
      higher: 192000,
      exhigh: 320000,
      lossless: 999000,
      hires: 999000,
      jyeffect: 999000,
      sky: 999000,
      dolby: 999000,
      jymaster: 999000
    };

    return bitrates[quality] || 320000;
  }

  function extractDownloadInfo(data) {
    if (!data) return null;

    var source = data.data;

    if (Array.isArray(source)) {
      source = source[0];
    }

    if (!source && data.url) {
      source = data;
    }

    if (!source || !source.url) return null;

    return {
      url: source.url,
      type: source.type || '',
      level: source.level || '',
      size: source.size || 0
    };
  }

  function requestDownloadInfo(songId, quality) {
    var cookie = typeof window.getNCookie === 'function'
      ? window.getNCookie()
      : '';

    var cookieQuery = cookie
      ? '&cookie=' + encodeURIComponent(cookie)
      : '';

    return window.fAPI(
      '/song/download/url/v1?id=' +
      encodeURIComponent(songId) +
      '&level=' +
      encodeURIComponent(quality) +
      cookieQuery
    ).then(function(data) {
      var info = extractDownloadInfo(data);

      if (info) return info;

      return window.fAPI(
        '/song/download/url?id=' +
        encodeURIComponent(songId) +
        '&br=' +
        getBitrateForQuality(quality) +
        cookieQuery
      ).then(function(fallbackData) {
        var fallbackInfo = extractDownloadInfo(fallbackData);

        if (fallbackInfo) return fallbackInfo;

        return window.fAPI(
          '/song/url/v1?id=' +
          encodeURIComponent(songId) +
          '&level=' +
          encodeURIComponent(quality) +
          cookieQuery
        ).then(function(playData) {
          return extractDownloadInfo(playData);
        });
      });
    }).catch(function() {
      return window.fAPI(
        '/song/url/v1?id=' +
        encodeURIComponent(songId) +
        '&level=' +
        encodeURIComponent(quality) +
        cookieQuery
      ).then(function(playData) {
        return extractDownloadInfo(playData);
      });
    });
  }

  function sanitizeFilename(value) {
    var filename = String(value || '未知歌曲')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

    return filename || '未知歌曲';
  }

  function inferExtension(info, blob) {
    var type = String(info && info.type ? info.type : '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (
      type === 'mp3' ||
      type === 'flac' ||
      type === 'm4a' ||
      type === 'aac' ||
      type === 'wav' ||
      type === 'ogg'
    ) {
      return type;
    }

    var mime = blob && blob.type
      ? blob.type.toLowerCase()
      : '';

    if (mime.indexOf('flac') !== -1) return 'flac';
    if (mime.indexOf('mp4') !== -1) return 'm4a';
    if (mime.indexOf('aac') !== -1) return 'aac';
    if (mime.indexOf('wav') !== -1) return 'wav';
    if (mime.indexOf('ogg') !== -1) return 'ogg';

    try {
      var path = new URL(info.url).pathname;
      var match = path.match(/\.([a-zA-Z0-9]{2,5})$/);

      if (match) return match[1].toLowerCase();
    } catch (error) {}

    return 'mp3';
  }

  function setDownloadButtonLoading(button, loading) {
    if (!button) return;

    button.disabled = loading;
    button.style.opacity = loading ? '0.55' : '';

    button.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i>'
      : '<i class="fas fa-download"></i>';
  }

  function fetchAudioBlob(url) {
    var fetchFunction = window.__directFetch || window.fetch.bind(window);
    var controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;

    var timer = controller
      ? setTimeout(function() {
          controller.abort();
        }, DOWNLOAD_TIMEOUT)
      : null;

    return fetchFunction(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined
    }).then(function(response) {
      if (!response.ok) {
        throw new Error('音频服务器返回 HTTP ' + response.status);
      }

      var contentType = response.headers.get('content-type') || '';

      if (
        contentType &&
        contentType.indexOf('audio/') !== 0 &&
        contentType.indexOf('application/octet-stream') !== 0 &&
        contentType.indexOf('application/flac') !== 0
      ) {
        throw new Error('音频服务器返回了无效文件类型：' + contentType);
      }

      return response.blob();
    }).then(function(blob) {
      if (!blob || blob.size === 0) {
        throw new Error('下载到的音乐文件为空');
      }

      return blob;
    }).finally(function() {
      if (timer) clearTimeout(timer);
    });
  }

  function triggerBlobDownload(blob, filename) {
    var objectUrl = URL.createObjectURL(blob);
    var anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(function() {
      URL.revokeObjectURL(objectUrl);
    }, 30000);
  }

  window.downloadSong = function(id, name, artist, button) {
    var songId = safeSongId(id);

    if (!songId) {
      window.toast('歌曲 ID 无效，无法下载');
      return;
    }

    var quality = getSelectedQuality();

    setDownloadButtonLoading(button, true);
    window.toast('正在获取歌曲下载地址...');

    requestDownloadInfo(songId, quality)
      .then(function(info) {
        if (!info || !info.url) {
          throw new Error('未获取到可用的下载地址，歌曲可能没有下载权限');
        }

        return fetchAudioBlob(info.url).then(function(blob) {
          var extension = inferExtension(info, blob);
          var filename = sanitizeFilename(
            (artist ? artist + ' - ' : '') + name
          ) + '.' + extension;

          triggerBlobDownload(blob, filename);
          window.toast('歌曲下载已开始');
        });
      })
      .catch(function(error) {
        console.error('[歌曲下载] 下载失败：', error);
        window.toast(
          '下载失败：' +
          (
            error && error.name === 'AbortError'
              ? '请求超时，请稍后重试'
              : error && error.message
                ? error.message
                : '链接可能已过期、跨域请求被拒绝或歌曲没有下载权限'
          )
        );
      })
      .finally(function() {
        setDownloadButtonLoading(button, false);
      });
  };

  window.downloadCurrentSong = function(button) {
    if (
      !Array.isArray(window.list) ||
      window.idx < 0 ||
      !window.list[window.idx]
    ) {
      window.toast('请先播放一首歌曲');
      return;
    }

    var song = normalizeSong(window.list[window.idx]);

    window.downloadSong(
      song.id,
      song.nm,
      song.ar,
      button
    );
  };

  // ==================== 频谱开关 ====================

  window.visEnabled = readBooleanPreference(
    VISIBILITY_KEY,
    true
  );

  function updateVisualizerState() {
    var enabled = window.visEnabled !== false;
    var canvas = getElement('visualizerCanvas');
    var homeSwitch = getElement('homeVisualizerSwitch');

    if (canvas) {
      canvas.style.display = enabled ? '' : 'none';

      if (!enabled) {
        var context = canvas.getContext('2d');

        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    if (homeSwitch) {
      homeSwitch.checked = enabled;
    }

    ['visToggleBtn', 'fpVisToggleBtn'].forEach(function(id) {
      var button = getElement(id);

      if (!button) return;

      button.style.color = enabled ? 'var(--primary)' : '';
      button.title = enabled ? '关闭频谱' : '开启频谱';
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
  }

  window.setVisualizerEnabled = function(enabled, notify) {
    window.visEnabled = !!enabled;
    writeBooleanPreference(VISIBILITY_KEY, window.visEnabled);
    updateVisualizerState();

    if (notify !== false && typeof window.toast === 'function') {
      window.toast(window.visEnabled ? '频谱已开启' : '频谱已关闭');
    }
  };

  window.toggleVis = function() {
    window.setVisualizerEnabled(window.visEnabled === false);
  };

  // ==================== 悬浮歌词持久化 ====================

  window.pipLyricsEnabled = readBooleanPreference(
    PIP_PREFERENCE_KEY,
    false
  );

  var nativeToggleLyricsPiP =
    typeof window.toggleLyricsPiP === 'function'
      ? window.toggleLyricsPiP
      : null;

  function isLyricsPipOpen() {
    return !!document.pictureInPictureElement;
  }

  function updatePipControls() {
    var preferenceSwitch = getElement('homePipLyricsSwitch');
    var actionButton = getElement('homePipLyricsAction');
    var active = isLyricsPipOpen();

    if (preferenceSwitch) {
      preferenceSwitch.checked = window.pipLyricsEnabled === true;
    }

    if (actionButton) {
      actionButton.disabled = !window.pipLyricsEnabled;
      actionButton.innerHTML = active
        ? '<i class="fas fa-times"></i> 关闭悬浮窗'
        : '<i class="fas fa-tv"></i> 打开悬浮窗';

      actionButton.title =
        window.pipLyricsEnabled && !active
          ? '浏览器要求通过点击操作打开画中画'
          : '';
    }

    ['pipLyricsBtn', 'fpPipLyricsBtn'].forEach(function(id) {
      var button = getElement(id);

      if (!button) return;

      button.style.color = active ? 'var(--primary)' : '';
      button.title = active
        ? '关闭歌词悬浮窗'
        : '歌词悬浮窗（画中画）';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setPipPreference(enabled) {
    window.pipLyricsEnabled = !!enabled;
    writeBooleanPreference(
      PIP_PREFERENCE_KEY,
      window.pipLyricsEnabled
    );

    updatePipControls();
  }

  if (nativeToggleLyricsPiP) {
    window.toggleLyricsPiP = function() {
      var wasOpen = isLyricsPipOpen();

      if (!wasOpen) {
        setPipPreference(true);
      }

      return Promise.resolve(nativeToggleLyricsPiP())
        .then(function(result) {
          if (wasOpen) {
            setPipPreference(false);
          }

          setTimeout(updatePipControls, 0);
          return result;
        })
        .catch(function(error) {
          if (!wasOpen) {
            setPipPreference(false);
          }

          updatePipControls();
          throw error;
        });
    };
  }

  window.setPipLyricsEnabled = function(enabled) {
    setPipPreference(enabled);

    if (!enabled && isLyricsPipOpen()) {
      if (document.exitPictureInPicture) {
        document.exitPictureInPicture()
          .catch(function() {})
          .then(updatePipControls);
      }

      return;
    }

    if (enabled && !isLyricsPipOpen()) {
      if (nativeToggleLyricsPiP) {
        window.toggleLyricsPiP();
      } else {
        window.toast('悬浮歌词模块未加载');
      }
    }
  };

  window.openPreferredLyricsPip = function() {
    if (!window.pipLyricsEnabled) {
      window.toast('请先开启悬浮歌词');
      return;
    }

    if (typeof window.toggleLyricsPiP !== 'function') {
      window.toast('悬浮歌词模块未加载');
      return;
    }

    window.toggleLyricsPiP();
  };

  document.addEventListener(
    'enterpictureinpicture',
    updatePipControls,
    true
  );

  document.addEventListener(
    'leavepictureinpicture',
    updatePipControls,
    true
  );

  // ==================== 主页音乐工具 ====================

  function injectEnhancementStyles() {
    if (getElement('playerEnhancementStyles')) return;

    var style = document.createElement('style');
    style.id = 'playerEnhancementStyles';
    style.textContent = `
      .song-card-main {
        display: flex;
        flex: 1;
        min-width: 0;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }

      .s-item > .s-actions {
        flex-shrink: 0;
      }

      .custom-playlist-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: rgba(243, 18, 96, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: var(--primary);
        font-size: 18px;
      }

      .home-music-tools {
        margin-top: 14px;
        margin-bottom: 14px;
      }

      .home-music-tools-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }

      .home-music-tool {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid var(--glass-border);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.035);
      }

      .home-music-tool-icon {
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 10px;
        color: var(--primary);
        background: rgba(243, 18, 96, 0.12);
      }

      .home-music-tool-copy {
        flex: 1;
        min-width: 0;
      }

      .home-music-tool-title {
        color: var(--text-main);
        font-size: 13px;
        font-weight: 600;
      }

      .home-music-tool-desc {
        color: var(--text-secondary);
        font-size: 11px;
        line-height: 1.5;
        margin-top: 3px;
      }

      .home-music-tool-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .player-setting-switch {
        position: relative;
        width: 42px;
        height: 24px;
        flex-shrink: 0;
      }

      .player-setting-switch input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      .player-setting-switch span {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.13);
        border: 1px solid var(--glass-border);
        transition: background 0.2s, border-color 0.2s;
      }

      .player-setting-switch span::after {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        left: 2px;
        top: 2px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s;
      }

      .player-setting-switch input:checked + span {
        background: var(--primary);
        border-color: var(--primary);
      }

      .player-setting-switch input:checked + span::after {
        transform: translateX(18px);
      }

      .home-tool-button {
        white-space: nowrap;
        padding: 7px 10px;
        font-size: 11px;
      }

      .song-download-btn:disabled {
        cursor: wait;
      }

      @media (max-width: 760px) {
        .home-music-tools-grid {
          grid-template-columns: 1fr;
        }

        .home-music-tool {
          align-items: flex-start;
        }

        .home-music-tool-actions {
          align-self: center;
        }
      }

      @media (max-width: 430px) {
        .home-music-tool {
          flex-wrap: wrap;
        }

        .home-music-tool-copy {
          min-width: calc(100% - 52px);
        }

        .home-music-tool-actions {
          width: 100%;
          justify-content: flex-end;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createHomeToolsCard() {
    if (getElement('homeMusicTools')) return;

    var homePage = getElement('pgHome');

    if (!homePage) return;

    var card = document.createElement('div');
    card.id = 'homeMusicTools';
    card.className = 'card full-w home-music-tools';

    card.innerHTML =
      '<div class="ct">' +
        '<i class="fas fa-sliders-h"></i> 音乐工具' +
      '</div>' +
      '<div class="home-music-tools-grid">' +
        '<div class="home-music-tool">' +
          '<div class="home-music-tool-icon">' +
            '<i class="fas fa-tv"></i>' +
          '</div>' +
          '<div class="home-music-tool-copy">' +
            '<div class="home-music-tool-title">悬浮歌词</div>' +
            '<div class="home-music-tool-desc">' +
              '将 Canvas 歌词伪装成视频，通过画中画窗口悬浮显示' +
            '</div>' +
          '</div>' +
          '<div class="home-music-tool-actions">' +
            '<label class="player-setting-switch" title="启用悬浮歌词">' +
              '<input type="checkbox" id="homePipLyricsSwitch" />' +
              '<span></span>' +
            '</label>' +
            '<button type="button" class="btn btn-o home-tool-button" ' +
              'id="homePipLyricsAction">' +
              '<i class="fas fa-tv"></i> 打开悬浮窗' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="home-music-tool">' +
          '<div class="home-music-tool-icon">' +
            '<i class="fas fa-wave-square"></i>' +
          '</div>' +
          '<div class="home-music-tool-copy">' +
            '<div class="home-music-tool-title">环形频谱</div>' +
            '<div class="home-music-tool-desc">' +
              '控制全屏播放器封面周围的动态音频频谱' +
            '</div>' +
          '</div>' +
          '<div class="home-music-tool-actions">' +
            '<label class="player-setting-switch" title="启用环形频谱">' +
              '<input type="checkbox" id="homeVisualizerSwitch" />' +
              '<span></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="home-music-tool">' +
          '<div class="home-music-tool-icon">' +
            '<i class="fas fa-database"></i>' +
          '</div>' +
          '<div class="home-music-tool-copy">' +
            '<div class="home-music-tool-title">音乐缓存管理</div>' +
            '<div class="home-music-tool-desc">' +
              '查看、播放、批量删除浏览器中缓存的音乐文件' +
            '</div>' +
          '</div>' +
          '<div class="home-music-tool-actions">' +
            '<button type="button" class="btn btn-o home-tool-button" ' +
              'id="homeCacheManagerButton">' +
              '<i class="fas fa-database"></i> 管理缓存' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="home-music-tool">' +
          '<div class="home-music-tool-icon">' +
            '<i class="fas fa-download"></i>' +
          '</div>' +
          '<div class="home-music-tool-copy">' +
            '<div class="home-music-tool-title">下载当前歌曲</div>' +
            '<div class="home-music-tool-desc">' +
              '按照当前选择的音质获取歌曲下载地址并保存到本地' +
            '</div>' +
          '</div>' +
          '<div class="home-music-tool-actions">' +
            '<button type="button" class="btn btn-o home-tool-button" ' +
              'id="homeDownloadCurrentButton">' +
              '<i class="fas fa-download"></i> 下载' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var topStatus = getElement('topStatus');

    if (topStatus && topStatus.parentNode === homePage) {
      homePage.insertBefore(card, topStatus.nextSibling);
    } else {
      homePage.insertBefore(card, homePage.firstChild);
    }

    getElement('homePipLyricsSwitch')
      .addEventListener('change', function() {
        window.setPipLyricsEnabled(this.checked);
      });

    getElement('homePipLyricsAction')
      .addEventListener('click', function() {
        window.openPreferredLyricsPip();
      });

    getElement('homeVisualizerSwitch')
      .addEventListener('change', function() {
        window.setVisualizerEnabled(this.checked);
      });

    getElement('homeCacheManagerButton')
      .addEventListener('click', function() {
        if (typeof window.openCacheManager === 'function') {
          window.openCacheManager();
        } else {
          window.toast('缓存管理模块未加载');
        }
      });

    getElement('homeDownloadCurrentButton')
      .addEventListener('click', function() {
        window.downloadCurrentSong(this);
      });
  }

  function removeCacheEntryFromPersonalization() {
    var oldEntry = getElement('cacheSettingEntry');

    if (oldEntry && oldEntry.parentNode) {
      oldEntry.parentNode.removeChild(oldEntry);
    }
  }

  function restoreDirectFetch() {
    if (window.__directFetch) {
      window.fetch = window.__directFetch;
    }
  }

  function initializeEnhancements() {
    restoreDirectFetch();
    injectEnhancementStyles();
    normalizeStoredCollections();
    createHomeToolsCard();
    removeCacheEntryFromPersonalization();
    updateVisualizerState();
    updatePipControls();

    if (window.currentPage === 'mine') {
      refreshCurrentMineTab();
    }

    // cache.js 与 ui.js 也在 DOMContentLoaded 阶段注入元素。
    // 延迟再次同步，确保动态按钮和旧缓存入口均已处理完成。
    setTimeout(function() {
      removeCacheEntryFromPersonalization();
      updateVisualizerState();
      updatePipControls();
    }, 0);
  }

  // feature-fixes.js 已在本模块前执行，此时可立即恢复原生 Fetch。
  restoreDirectFetch();

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initializeEnhancements
    );
  } else {
    initializeEnhancements();
  }

  window.addEventListener('storage', function(event) {
    if (event.key === VISIBILITY_KEY) {
      window.visEnabled = readBooleanPreference(
        VISIBILITY_KEY,
        true
      );

      updateVisualizerState();
    }

    if (event.key === PIP_PREFERENCE_KEY) {
      window.pipLyricsEnabled = readBooleanPreference(
        PIP_PREFERENCE_KEY,
        false
      );

      updatePipControls();
    }
  });
})();
