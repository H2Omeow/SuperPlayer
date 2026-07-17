// ==================== 音乐缓存与播放列表增强模块 ====================

(function() {
  'use strict';

  var DB_NAME = 'super_player_music_cache';
  var DB_VERSION = 1;
  var STORE_NAME = 'music_cache';

  var dbPromise = null;
  var cacheSelection = new Set();
  var cachingTasks = {};
  var playbackRequestToken = 0;
  var activeObjectUrl = '';
  var originalLoadAudioSrc = window.loadAudioSrc;

  var qualityLabels = {
    standard: '标准',
    higher: '较高',
    exhigh: '极高',
    lossless: '无损'
  };

  function openCacheDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function(resolve, reject) {
      if (!('indexedDB' in window)) {
        reject(new Error('当前浏览器不支持 IndexedDB'));
        return;
      }

      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function(event) {
        var db = event.target.result;
        var store;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        } else {
          store = event.target.transaction.objectStore(STORE_NAME);
        }

        if (!store.indexNames.contains('songId')) {
          store.createIndex('songId', 'songId', { unique: false });
        }

        if (!store.indexNames.contains('cachedAt')) {
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };

      request.onsuccess = function() {
        var db = request.result;

        db.onversionchange = function() {
          db.close();
          dbPromise = null;
        };

        resolve(db);
      };

      request.onerror = function() {
        dbPromise = null;
        reject(request.error || new Error('音乐缓存数据库打开失败'));
      };

      request.onblocked = function() {
        console.warn('[音乐缓存] 数据库升级被其他页面阻塞');
      };
    });

    return dbPromise;
  }

  function createCacheKey(songId, quality) {
    return String(songId) + '|' + String(quality || 'exhigh');
  }

  function getCacheRecord(key) {
    return openCacheDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var transaction = db.transaction(STORE_NAME, 'readonly');
        var store = transaction.objectStore(STORE_NAME);
        var request = store.get(key);

        request.onsuccess = function() {
          resolve(request.result || null);
        };

        request.onerror = function() {
          reject(request.error || new Error('读取音乐缓存失败'));
        };
      });
    });
  }

  function getAllCacheRecords() {
    return openCacheDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var transaction = db.transaction(STORE_NAME, 'readonly');
        var store = transaction.objectStore(STORE_NAME);
        var request = store.getAll();

        request.onsuccess = function() {
          var records = request.result || [];
          records.sort(function(a, b) {
            return (b.cachedAt || 0) - (a.cachedAt || 0);
          });
          resolve(records);
        };

        request.onerror = function() {
          reject(request.error || new Error('读取缓存列表失败'));
        };
      });
    });
  }

  function getPreferredCacheRecord(songId, quality) {
    var exactKey = createCacheKey(songId, quality);

    return getCacheRecord(exactKey).then(function(exactRecord) {
      if (exactRecord && exactRecord.blob) return exactRecord;

      return getAllCacheRecords().then(function(records) {
        var matched = records.filter(function(record) {
          return String(record.songId) === String(songId) && record.blob;
        });

        return matched.length > 0 ? matched[0] : null;
      });
    });
  }

  function putCacheRecord(record) {
    return openCacheDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var transaction = db.transaction(STORE_NAME, 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        store.put(record);

        transaction.oncomplete = function() {
          resolve(record);
        };

        transaction.onerror = function() {
          reject(transaction.error || new Error('写入音乐缓存失败'));
        };

        transaction.onabort = function() {
          reject(transaction.error || new Error('写入音乐缓存已中止'));
        };
      });
    });
  }

  function deleteCacheRecords(keys) {
    if (!keys || keys.length === 0) return Promise.resolve();

    return openCacheDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var transaction = db.transaction(STORE_NAME, 'readwrite');
        var store = transaction.objectStore(STORE_NAME);

        keys.forEach(function(key) {
          store.delete(key);
        });

        transaction.oncomplete = function() {
          resolve();
        };

        transaction.onerror = function() {
          reject(transaction.error || new Error('删除音乐缓存失败'));
        };

        transaction.onabort = function() {
          reject(transaction.error || new Error('删除音乐缓存已中止'));
        };
      });
    });
  }

  function clearCacheRecords() {
    return openCacheDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var transaction = db.transaction(STORE_NAME, 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        store.clear();

        transaction.oncomplete = function() {
          resolve();
        };

        transaction.onerror = function() {
          reject(transaction.error || new Error('清空音乐缓存失败'));
        };

        transaction.onabort = function() {
          reject(transaction.error || new Error('清空音乐缓存已中止'));
        };
      });
    });
  }

  function escapeAttribute(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatBytes(bytes) {
    var size = Number(bytes) || 0;

    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    if (size < 1024 * 1024 * 1024) {
      return (size / 1024 / 1024).toFixed(1) + ' MB';
    }

    return (size / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function formatCacheDate(timestamp) {
    if (!timestamp) return '未知时间';

    var date = new Date(timestamp);
    if (isNaN(date.getTime())) return '未知时间';

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getCurrentQuality() {
    var qualitySelect = document.getElementById('qSel');
    return qualitySelect ? qualitySelect.value : 'exhigh';
  }

  function releaseActiveObjectUrl() {
    if (!activeObjectUrl) return;

    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch (e) {}

    activeObjectUrl = '';
  }

  function refreshCacheManagerIfOpen() {
    var modal = document.getElementById('cacheModal');

    if (modal && modal.classList.contains('show')) {
      window.renderCacheManager();
    }
  }

  function cacheSongFromUrl(song, url, quality) {
    if (!song || song.id == null || !url || url.indexOf('blob:') === 0) {
      return Promise.resolve(null);
    }

    var key = createCacheKey(song.id, quality);

    if (cachingTasks[key]) return cachingTasks[key];

    cachingTasks[key] = getCacheRecord(key)
      .then(function(existing) {
        if (existing && existing.blob) return existing;

        return fetch(url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit'
        })
        .then(function(response) {
          if (!response.ok) {
            throw new Error('音频下载失败：HTTP ' + response.status);
          }

          return response.blob();
        })
        .then(function(blob) {
          if (!blob || blob.size === 0) {
            throw new Error('获取到的音频文件为空');
          }

          var record = {
            key: key,
            songId: String(song.id),
            name: song.nm || '未知歌曲',
            artist: song.ar || '未知歌手',
            cover: song.pc || '',
            quality: quality || 'exhigh',
            mimeType: blob.type || 'audio/mpeg',
            size: blob.size,
            cachedAt: Date.now(),
            blob: blob
          };

          return putCacheRecord(record);
        });
      })
      .then(function(record) {
        delete cachingTasks[key];
        refreshCacheManagerIfOpen();
        return record;
      })
      .catch(function(error) {
        delete cachingTasks[key];
        console.warn('[音乐缓存] 自动缓存失败：', error.message);
        return null;
      });

    return cachingTasks[key];
  }

  function updatePlayingInterface(song) {
    var coverUrl = song.pc || '';
    var placeholder = window.coverPlaceholder();

    var playerBar = document.getElementById('pBar');
    var playerTitle = document.getElementById('pTtl');
    var playerArtist = document.getElementById('pArt');
    var playerCover = document.getElementById('pCvr');
    var fullCover = document.getElementById('fpCvr');
    var statusCover = document.getElementById('statusCover');
    var fullTitle = document.getElementById('fpTtl');
    var fullArtist = document.getElementById('fpArt');
    var nowPlaying = document.getElementById('nowPlaying');
    var statusArtist = document.getElementById('statusArtist');

    if (playerBar) playerBar.style.display = 'flex';
    if (playerTitle) playerTitle.textContent = song.nm || '未知歌曲';
    if (playerArtist) playerArtist.textContent = song.ar || '未知歌手';
    if (fullTitle) fullTitle.textContent = song.nm || '未知歌曲';
    if (fullArtist) fullArtist.textContent = song.ar || '未知歌手';
    if (nowPlaying) nowPlaying.textContent = song.nm || '未知歌曲';
    if (statusArtist) statusArtist.textContent = song.ar || '未知歌手';

    if (coverUrl) {
      if (playerCover) playerCover.src = coverUrl + '?param=100y100';
      if (fullCover) fullCover.src = coverUrl + '?param=400y400';
      if (statusCover) statusCover.src = coverUrl + '?param=100y100';
    } else {
      if (playerCover) playerCover.src = placeholder;
      if (fullCover) fullCover.src = placeholder;
      if (statusCover) statusCover.src = placeholder;
    }
  }

  function prepareSongPlayback(song) {
    updatePlayingInterface(song);

    window.lastLyricIdx = -1;
    window.addToHistory(song);
    window.fLrc(song.id);
    window.updateMediaSession(song, '正在匹配歌词...');
  }

  function playAudioUrl(url) {
    releaseActiveObjectUrl();

    if (typeof originalLoadAudioSrc === 'function') {
      originalLoadAudioSrc(url);
      return;
    }

    var audio = document.getElementById('aPlayer');
    if (!audio) return;

    audio.src = url;
    audio.play()
      .then(function() {
        window.play = true;
        window.upIcn();
      })
      .catch(function() {
        window.toast('请手动点击播放按钮');
      });
  }

  function playCachedBlob(record) {
    if (!record || !record.blob) return false;

    releaseActiveObjectUrl();
    activeObjectUrl = URL.createObjectURL(record.blob);

    if (typeof originalLoadAudioSrc === 'function') {
      originalLoadAudioSrc(activeObjectUrl);
    } else {
      var audio = document.getElementById('aPlayer');

      if (audio) {
        audio.src = activeObjectUrl;
        audio.play()
          .then(function() {
            window.play = true;
            window.upIcn();
          })
          .catch(function() {
            window.toast('请手动点击播放按钮');
          });
      }
    }

    return true;
  }

  function fetchPrimarySongUrl(song, quality, cookie, token) {
    var bitrates = {
      standard: 128000,
      higher: 192000,
      exhigh: 320000,
      lossless: 999000
    };

    var backupBitrate = bitrates[quality] || 320000;
    var cookieQuery = cookie ? '&cookie=' + encodeURIComponent(cookie) : '';

    return window.fAPI(
      '/song/url/v1?id=' + song.id +
      '&level=' + encodeURIComponent(quality) +
      cookieQuery
    )
    .then(function(data) {
      if (token !== playbackRequestToken) return null;

      if (
        data &&
        data.code === 200 &&
        data.data &&
        data.data[0] &&
        data.data[0].url
      ) {
        return data.data[0].url;
      }

      return window.fAPI(
        '/song/url?id=' + song.id +
        '&br=' + backupBitrate +
        cookieQuery
      )
      .then(function(backupData) {
        if (token !== playbackRequestToken) return null;

        if (
          backupData &&
          backupData.code === 200 &&
          backupData.data &&
          backupData.data[0] &&
          backupData.data[0].url
        ) {
          return backupData.data[0].url;
        }

        return null;
      });
    })
    .catch(function() {
      if (token !== playbackRequestToken) return null;

      return window.fAPI(
        '/song/url?id=' + song.id +
        '&br=' + backupBitrate +
        cookieQuery
      )
      .then(function(backupData) {
        if (token !== playbackRequestToken) return null;

        if (
          backupData &&
          backupData.code === 200 &&
          backupData.data &&
          backupData.data[0] &&
          backupData.data[0].url
        ) {
          return backupData.data[0].url;
        }

        return null;
      })
      .catch(function() {
        return null;
      });
    });
  }

  // 覆盖原播放入口：先查询 IndexedDB，未命中时再请求在线音频。
  window.playByIdx = function(index) {
    if (
      !Array.isArray(window.list) ||
      index < 0 ||
      index >= window.list.length
    ) {
      return;
    }

    var token = ++playbackRequestToken;
    var song = window.list[index];
    var quality = getCurrentQuality();
    var cookie = window.getNCookie ? window.getNCookie() : '';

    window.idx = index;
    prepareSongPlayback(song);
    window.renderPL();

    getPreferredCacheRecord(song.id, quality)
      .then(function(record) {
        if (token !== playbackRequestToken) return;

        if (record && record.blob) {
          playCachedBlob(record);
          return;
        }

        return fetchPrimarySongUrl(song, quality, cookie, token)
          .then(function(url) {
            if (token !== playbackRequestToken) return;

            if (!url) {
              window.toast('音频获取受阻，可能为 VIP 或无版权歌曲');
              return;
            }

            playAudioUrl(url);
            cacheSongFromUrl(song, url, quality);
          });
      })
      .catch(function(error) {
        if (token !== playbackRequestToken) return;

        console.warn('[音乐缓存] 缓存读取失败，改用在线播放：', error.message);

        fetchPrimarySongUrl(song, quality, cookie, token)
          .then(function(url) {
            if (token !== playbackRequestToken) return;

            if (!url) {
              window.toast('音频服务异常，请稍后重试');
              return;
            }

            playAudioUrl(url);
            cacheSongFromUrl(song, url, quality);
          });
      });
  };

  // ==================== 播放全部 ====================

  window.playAllCurrentList = function() {
    if (!Array.isArray(window.list) || window.list.length === 0) {
      window.toast('当前播放列表为空');
      return;
    }

    window.playByIdx(0);

    var modal = document.getElementById('plModal');
    if (modal) modal.classList.remove('show');
  };

  window.playAllCustomList = function() {
    if (
      window.activeCustomPlIdx < 0 ||
      !window.customPlaylists ||
      !window.customPlaylists[window.activeCustomPlIdx]
    ) {
      window.toast('未找到自定义歌单');
      return;
    }

    var songs = window.customPlaylists[window.activeCustomPlIdx].songs || [];

    if (songs.length === 0) {
      window.toast('该歌单中暂无歌曲');
      return;
    }

    window.list = songs.map(function(song) {
      return {
        id: song.id,
        nm: song.nm,
        ar: song.ar,
        pc: song.pc || ''
      };
    });

    if (window.playMode === 'random') {
      window.originalList = window.list.slice();
    } else {
      window.originalList = [];
    }

    window.idx = -1;
    window.renderPL();
    window.playByIdx(0);

    var modal = document.getElementById('customPlModal');
    if (modal) modal.classList.remove('show');
  };

  // ==================== 缓存管理 ====================

  function updateCacheSelectionToolbar(totalCount) {
    var selectedCount = cacheSelection.size;
    var selectedText = document.getElementById('cacheSelectedCount');
    var deleteSelectedButton = document.getElementById('cacheDeleteSelectedBtn');
    var selectAllCheckbox = document.getElementById('cacheSelectAll');

    if (selectedText) {
      selectedText.textContent = '已选择 ' + selectedCount + ' 首';
    }

    if (deleteSelectedButton) {
      deleteSelectedButton.disabled = selectedCount === 0;
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.checked =
        totalCount > 0 && selectedCount === totalCount;
      selectAllCheckbox.indeterminate =
        selectedCount > 0 && selectedCount < totalCount;
    }
  }

  function updateStorageEstimate() {
    var element = document.getElementById('cacheStorageEstimate');
    if (!element) return;

    if (!navigator.storage || !navigator.storage.estimate) {
      element.textContent = '浏览器未提供存储空间统计';
      return;
    }

    navigator.storage.estimate()
      .then(function(estimate) {
        var usage = estimate.usage || 0;
        var quota = estimate.quota || 0;

        if (quota > 0) {
          element.textContent =
            '浏览器已使用 ' +
            formatBytes(usage) +
            ' / ' +
            formatBytes(quota);
        } else {
          element.textContent = '浏览器已使用 ' + formatBytes(usage);
        }
      })
      .catch(function() {
        element.textContent = '无法读取浏览器存储空间';
      });
  }

  window.openCacheManager = function() {
    var modal = document.getElementById('cacheModal');
    if (!modal) return;

    modal.classList.add('show');
    window.renderCacheManager();
  };

  window.closeCacheManager = function() {
    var modal = document.getElementById('cacheModal');
    if (modal) modal.classList.remove('show');
  };

  window.renderCacheManager = function() {
    var listElement = document.getElementById('cacheMusicList');
    var summaryElement = document.getElementById('cacheSummary');

    if (!listElement) return;

    listElement.innerHTML =
      '<div class="cache-loading">' +
      '<div class="spin"></div>' +
      '<span>正在读取音乐缓存...</span>' +
      '</div>';

    getAllCacheRecords()
      .then(function(records) {
        var validKeys = {};

        records.forEach(function(record) {
          validKeys[record.key] = true;
        });

        Array.from(cacheSelection).forEach(function(key) {
          if (!validKeys[key]) cacheSelection.delete(key);
        });

        var totalSize = records.reduce(function(total, record) {
          return total + (record.size || 0);
        }, 0);

        if (summaryElement) {
          summaryElement.textContent =
            '共缓存 ' +
            records.length +
            ' 首音乐，占用 ' +
            formatBytes(totalSize);
        }

        if (records.length === 0) {
          listElement.innerHTML =
            '<div class="cache-empty">' +
            '<i class="fas fa-box-open"></i>' +
            '<div class="cache-empty-title">暂无音乐缓存</div>' +
            '<div class="cache-empty-desc">播放在线歌曲后，系统会在后台自动尝试缓存</div>' +
            '</div>';

          updateCacheSelectionToolbar(0);
          updateStorageEstimate();
          return;
        }

        listElement.innerHTML = records.map(function(record) {
          var encodedKey = encodeURIComponent(record.key);
          var cover = record.cover
            ? record.cover + '?param=100y100'
            : window.coverPlaceholder();
          var checked = cacheSelection.has(record.key) ? ' checked' : '';

          return (
            '<div class="cache-music-item" data-cache-key="' +
            escapeAttribute(encodedKey) +
            '">' +
              '<label class="cache-check-wrap" title="选择">' +
                '<input type="checkbox" class="cache-item-check" data-cache-key="' +
                escapeAttribute(encodedKey) +
                '"' +
                checked +
                ' />' +
                '<span class="cache-check-mark"></span>' +
              '</label>' +
              '<img class="cache-cover" src="' +
              escapeAttribute(cover) +
              '" alt="" loading="lazy" onerror="imgFallback(this)" />' +
              '<div class="cache-song-info">' +
                '<div class="cache-song-name">' +
                window.escH(record.name || '未知歌曲') +
                '</div>' +
                '<div class="cache-song-artist">' +
                window.escH(record.artist || '未知歌手') +
                '</div>' +
                '<div class="cache-song-meta">' +
                  '<span><i class="fas fa-wave-square"></i> ' +
                  window.escH(
                    qualityLabels[record.quality] || record.quality || '未知音质'
                  ) +
                  '</span>' +
                  '<span><i class="fas fa-database"></i> ' +
                  formatBytes(record.size) +
                  '</span>' +
                  '<span><i class="fas fa-clock"></i> ' +
                  formatCacheDate(record.cachedAt) +
                  '</span>' +
                '</div>' +
              '</div>' +
              '<div class="cache-item-actions">' +
                '<button class="cache-action-button cache-play-button" data-cache-key="' +
                escapeAttribute(encodedKey) +
                '" title="播放缓存">' +
                  '<i class="fas fa-play"></i>' +
                '</button>' +
                '<button class="cache-action-button cache-delete-button" data-cache-key="' +
                escapeAttribute(encodedKey) +
                '" title="删除缓存">' +
                  '<i class="fas fa-trash"></i>' +
                '</button>' +
              '</div>' +
            '</div>'
          );
        }).join('');

        listElement.querySelectorAll('.cache-item-check').forEach(function(input) {
          input.addEventListener('change', function() {
            var key = decodeURIComponent(this.getAttribute('data-cache-key'));

            if (this.checked) {
              cacheSelection.add(key);
            } else {
              cacheSelection.delete(key);
            }

            updateCacheSelectionToolbar(records.length);
          });
        });

        listElement.querySelectorAll('.cache-play-button').forEach(function(button) {
          button.addEventListener('click', function() {
            var key = decodeURIComponent(this.getAttribute('data-cache-key'));
            window.playCachedMusic(key);
          });
        });

        listElement.querySelectorAll('.cache-delete-button').forEach(function(button) {
          button.addEventListener('click', function() {
            var key = decodeURIComponent(this.getAttribute('data-cache-key'));
            window.deleteSingleMusicCache(key);
          });
        });

        updateCacheSelectionToolbar(records.length);
        updateStorageEstimate();
      })
      .catch(function(error) {
        listElement.innerHTML =
          '<div class="cache-empty cache-error">' +
          '<i class="fas fa-exclamation-triangle"></i>' +
          '<div class="cache-empty-title">缓存读取失败</div>' +
          '<div class="cache-empty-desc">' +
          window.escH(error.message || '未知错误') +
          '</div>' +
          '</div>';

        if (summaryElement) summaryElement.textContent = '缓存不可用';
        updateCacheSelectionToolbar(0);
      });
  };

  window.toggleSelectAllMusicCache = function(checked) {
    getAllCacheRecords()
      .then(function(records) {
        cacheSelection.clear();

        if (checked) {
          records.forEach(function(record) {
            cacheSelection.add(record.key);
          });
        }

        window.renderCacheManager();
      })
      .catch(function(error) {
        window.toast(error.message || '全选缓存失败');
      });
  };

  window.playCachedMusic = function(key) {
    var token = ++playbackRequestToken;

    getCacheRecord(key)
      .then(function(record) {
        if (token !== playbackRequestToken) return;

        if (!record || !record.blob) {
          window.toast('该缓存已不存在');
          window.renderCacheManager();
          return;
        }

        var song = {
          id: record.songId,
          nm: record.name || '未知歌曲',
          ar: record.artist || '未知歌手',
          pc: record.cover || ''
        };

        var targetIndex = window.list.findIndex(function(item) {
          return String(item.id) === String(song.id);
        });

        if (targetIndex === -1) {
          window.list.push(song);
          targetIndex = window.list.length - 1;

          if (window.playMode === 'random') {
            window.originalList.push(song);
          }
        }

        window.idx = targetIndex;
        prepareSongPlayback(song);
        window.renderPL();
        playCachedBlob(record);
        window.closeCacheManager();
      })
      .catch(function(error) {
        window.toast(error.message || '缓存播放失败');
      });
  };

  window.deleteSingleMusicCache = function(key) {
    getCacheRecord(key)
      .then(function(record) {
        var songName = record && record.name ? record.name : '该歌曲';

        if (!confirm('确定删除“' + songName + '”的音乐缓存吗？')) {
          return null;
        }

        return deleteCacheRecords([key]).then(function() {
          cacheSelection.delete(key);
          window.toast('已删除音乐缓存');
          window.renderCacheManager();
        });
      })
      .catch(function(error) {
        window.toast(error.message || '删除缓存失败');
      });
  };

  window.deleteSelectedMusicCache = function() {
    var keys = Array.from(cacheSelection);

    if (keys.length === 0) {
      window.toast('请先选择需要删除的缓存');
      return;
    }

    if (!confirm('确定删除已选择的 ' + keys.length + ' 首音乐缓存吗？')) {
      return;
    }

    deleteCacheRecords(keys)
      .then(function() {
        cacheSelection.clear();
        window.toast('已删除选中的音乐缓存');
        window.renderCacheManager();
      })
      .catch(function(error) {
        window.toast(error.message || '批量删除缓存失败');
      });
  };

  window.clearAllMusicCache = function() {
    getAllCacheRecords()
      .then(function(records) {
        if (records.length === 0) {
          window.toast('当前没有可清理的音乐缓存');
          return null;
        }

        if (!confirm('确定清空全部 ' + records.length + ' 首音乐缓存吗？此操作无法撤销。')) {
          return null;
        }

        return clearCacheRecords().then(function() {
          cacheSelection.clear();
          releaseActiveObjectUrl();
          window.toast('已清空全部音乐缓存');
          window.renderCacheManager();
        });
      })
      .catch(function(error) {
        window.toast(error.message || '清空缓存失败');
      });
  };

  // ==================== 动态界面 ====================

  function injectCacheStyles() {
    if (document.getElementById('musicCacheStyles')) return;

    var style = document.createElement('style');
    style.id = 'musicCacheStyles';
    style.textContent = `
      .playlist-play-all-btn {
        margin-left: auto;
        padding: 7px 12px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .cache-setting-entry {
        justify-content: space-between;
        width: 100%;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--glass-border);
      }

      .cache-setting-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .cache-setting-title {
        color: var(--text-main);
        font-size: 13px;
        font-weight: 600;
      }

      .cache-setting-desc {
        color: var(--text-secondary);
        font-size: 11px;
        line-height: 1.5;
      }

      .cache-manage-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      #cacheModal .mc {
        max-width: 760px;
        max-height: 86vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .cache-manager-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        margin-bottom: 10px;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius);
      }

      .cache-manager-summary-main {
        min-width: 0;
      }

      #cacheSummary {
        color: var(--text-main);
        font-size: 13px;
        font-weight: 600;
      }

      #cacheStorageEstimate {
        color: var(--text-secondary);
        font-size: 11px;
        margin-top: 4px;
      }

      .cache-manager-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--glass-border);
      }

      .cache-select-all-label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--text-secondary);
        font-size: 12px;
        cursor: pointer;
        user-select: none;
      }

      .cache-select-all-label input {
        accent-color: var(--primary);
      }

      #cacheSelectedCount {
        color: var(--text-secondary);
        font-size: 12px;
        margin-right: auto;
      }

      .cache-toolbar-button {
        padding: 7px 11px;
        font-size: 12px;
      }

      .cache-toolbar-button:disabled {
        cursor: not-allowed;
        opacity: 0.4;
        box-shadow: none;
      }

      .cache-danger-button {
        border-color: rgba(248, 113, 113, 0.35);
        color: #f87171;
      }

      .cache-danger-button:hover {
        border-color: #f87171;
        color: #fff;
        background: rgba(248, 113, 113, 0.14);
      }

      .cache-music-list {
        min-height: 180px;
        max-height: 54vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
        padding-right: 3px;
      }

      .cache-music-item {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 10px;
        background: var(--card-bg);
        backdrop-filter: var(--blur-val);
        -webkit-backdrop-filter: var(--blur-val);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius);
        transition: border-color 0.2s, background 0.2s;
      }

      .cache-music-item:hover {
        border-color: rgba(243, 18, 96, 0.4);
      }

      .cache-check-wrap {
        position: relative;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        cursor: pointer;
      }

      .cache-check-wrap input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .cache-check-mark {
        position: absolute;
        inset: 1px;
        border: 1px solid var(--glass-border);
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.04);
        transition: all 0.2s;
      }

      .cache-check-wrap input:checked + .cache-check-mark {
        background: var(--primary);
        border-color: var(--primary);
      }

      .cache-check-wrap input:checked + .cache-check-mark::after {
        content: '';
        position: absolute;
        left: 5px;
        top: 2px;
        width: 4px;
        height: 8px;
        border: solid #fff;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }

      .cache-cover {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        object-fit: cover;
        border-radius: 8px;
      }

      .cache-song-info {
        flex: 1;
        min-width: 0;
      }

      .cache-song-name {
        color: var(--text-main);
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cache-song-artist {
        color: var(--text-secondary);
        font-size: 12px;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cache-song-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        color: var(--text-secondary);
        font-size: 10px;
        margin-top: 5px;
      }

      .cache-song-meta span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .cache-item-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }

      .cache-action-button {
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .cache-play-button:hover {
        color: #fff;
        background: var(--primary);
      }

      .cache-delete-button:hover {
        color: #fff;
        background: rgba(248, 113, 113, 0.8);
      }

      .cache-loading {
        min-height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: var(--text-secondary);
        font-size: 13px;
      }

      .cache-empty {
        min-height: 210px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        text-align: center;
        padding: 20px;
      }

      .cache-empty > i {
        font-size: 42px;
        opacity: 0.25;
        margin-bottom: 13px;
      }

      .cache-empty-title {
        color: var(--text-main);
        font-size: 14px;
        font-weight: 600;
      }

      .cache-empty-desc {
        max-width: 430px;
        font-size: 11px;
        line-height: 1.6;
        margin-top: 6px;
        opacity: 0.75;
      }

      .cache-error > i {
        color: #f87171;
        opacity: 0.75;
      }

      @media (max-width: 600px) {
        #cacheModal {
          padding: 10px;
        }

        #cacheModal .mc {
          padding: 16px;
          max-height: 90vh;
        }

        .playlist-play-all-btn {
          padding: 6px 9px;
        }

        .playlist-play-all-btn span {
          display: none;
        }

        .cache-setting-entry {
          align-items: flex-start;
        }

        .cache-manager-summary {
          align-items: flex-start;
          flex-direction: column;
        }

        .cache-music-list {
          max-height: 57vh;
        }

        .cache-music-item {
          gap: 8px;
          padding: 8px;
        }

        .cache-cover {
          width: 42px;
          height: 42px;
        }

        .cache-song-meta {
          gap: 6px;
        }

        .cache-song-meta span:nth-child(3) {
          display: none;
        }

        .cache-action-button {
          width: 29px;
          height: 29px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function addPlayAllButton(modalId, handlerName) {
    var modal = document.getElementById(modalId);
    if (!modal) return;

    var heading = modal.querySelector('.mc h2');
    if (!heading || heading.querySelector('.playlist-play-all-btn')) return;

    var closeButton = heading.querySelector('.close');
    var playAllButton = document.createElement('button');

    playAllButton.type = 'button';
    playAllButton.className = 'btn btn-o playlist-play-all-btn';
    playAllButton.innerHTML =
      '<i class="fas fa-play"></i><span>播放全部</span>';
    playAllButton.addEventListener('click', function(event) {
      event.stopPropagation();

      if (
        handlerName &&
        typeof window[handlerName] === 'function'
      ) {
        window[handlerName]();
      }
    });

    if (closeButton) {
      heading.insertBefore(playAllButton, closeButton);
    } else {
      heading.appendChild(playAllButton);
    }
  }

  function addCacheSettingEntry() {
    if (document.getElementById('cacheSettingEntry')) return;

    var wallpaperStatus = document.getElementById('bgStatusText');
    if (!wallpaperStatus) return;

    var wallpaperRow = wallpaperStatus.closest('.cg');
    if (!wallpaperRow || !wallpaperRow.parentNode) return;

    var entry = document.createElement('div');
    entry.id = 'cacheSettingEntry';
    entry.className = 'cg cache-setting-entry';
    entry.innerHTML =
      '<div class="cache-setting-copy">' +
        '<span class="cache-setting-title">音乐缓存管理</span>' +
        '<span class="cache-setting-desc">自动缓存播放过的音乐，可查看、播放或批量清理</span>' +
      '</div>' +
      '<button type="button" class="qrb cache-manage-button">' +
        '<i class="fas fa-database"></i> 管理缓存' +
      '</button>';

    entry.querySelector('button').addEventListener('click', function() {
      window.openCacheManager();
    });

    // 缓存管理放在壁纸刷新之前，保证壁纸刷新仍是个性化设置最后一项。
    wallpaperRow.parentNode.insertBefore(entry, wallpaperRow);

    var wallpaperButton = wallpaperRow.querySelector('button');
    if (wallpaperButton) {
      wallpaperButton.innerHTML =
        '<i class="fas fa-sync-alt"></i> 刷新壁纸';
      wallpaperButton.title = '随机刷新当前壁纸';
    }
  }

  function createCacheModal() {
    if (document.getElementById('cacheModal')) return;

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'cacheModal';

    modal.innerHTML =
      '<div class="mc">' +
        '<h2>' +
          '<span>' +
            '<i class="fas fa-database" style="color:var(--primary);margin-right:8px"></i>' +
            '音乐缓存管理' +
          '</span>' +
          '<button type="button" class="close" id="cacheModalCloseButton">' +
            '<i class="fas fa-times"></i>' +
          '</button>' +
        '</h2>' +
        '<div class="cache-manager-summary">' +
          '<div class="cache-manager-summary-main">' +
            '<div id="cacheSummary">正在统计缓存...</div>' +
            '<div id="cacheStorageEstimate">正在读取浏览器存储空间...</div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-secondary);line-height:1.5;">' +
            '歌曲播放后会自动尝试缓存<br />受跨域限制的音频仍可正常在线播放' +
          '</div>' +
        '</div>' +
        '<div class="cache-manager-toolbar">' +
          '<label class="cache-select-all-label">' +
            '<input type="checkbox" id="cacheSelectAll" />' +
            '<span>全选</span>' +
          '</label>' +
          '<span id="cacheSelectedCount">已选择 0 首</span>' +
          '<button type="button" class="btn btn-o cache-toolbar-button" id="cacheDeleteSelectedBtn" disabled>' +
            '<i class="fas fa-trash-alt"></i> 删除所选' +
          '</button>' +
          '<button type="button" class="btn btn-o cache-toolbar-button cache-danger-button" id="cacheClearAllBtn">' +
            '<i class="fas fa-broom"></i> 清空缓存' +
          '</button>' +
        '</div>' +
        '<div class="cache-music-list" id="cacheMusicList"></div>' +
      '</div>';

    modal.addEventListener('click', function(event) {
      if (event.target === modal) {
        window.closeCacheManager();
      }
    });

    document.body.appendChild(modal);

    document.getElementById('cacheModalCloseButton')
      .addEventListener('click', window.closeCacheManager);

    document.getElementById('cacheSelectAll')
      .addEventListener('change', function() {
        window.toggleSelectAllMusicCache(this.checked);
      });

    document.getElementById('cacheDeleteSelectedBtn')
      .addEventListener('click', window.deleteSelectedMusicCache);

    document.getElementById('cacheClearAllBtn')
      .addEventListener('click', window.clearAllMusicCache);
  }

  function initializeCacheFeatures() {
    injectCacheStyles();
    createCacheModal();
    addPlayAllButton('plModal', 'playAllCurrentList');
    addPlayAllButton('customPlModal', 'playAllCustomList');
    addCacheSettingEntry();

    openCacheDB().catch(function(error) {
      console.warn('[音乐缓存] 初始化失败：', error.message);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCacheFeatures);
  } else {
    initializeCacheFeatures();
  }

  window.addEventListener('beforeunload', function() {
    releaseActiveObjectUrl();
  });
})();
