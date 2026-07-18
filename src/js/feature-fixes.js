(function() {
  'use strict';

  // ==================== 通用辅助函数 ====================

  function safeNumericId(value) {
    return String(value == null ? '' : value).replace(/[^\d]/g, '');
  }

  function getSearchInputValue() {
    var input = document.getElementById('sIpt');
    return input ? input.value.trim() : '';
  }

  function getSearchGrid() {
    return document.getElementById('resGrid');
  }

  function getSearchResultSection() {
    return document.getElementById('sRes');
  }

  function getSearchCountElement() {
    return document.getElementById('resCnt');
  }

  function showSearchMessage(message) {
    var grid = getSearchGrid();

    if (!grid) return;

    grid.className = 's-list';
    grid.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--text-secondary)">' +
      window.escH(message) +
      '</div>';
  }

  function formatArtistNames(artists) {
    if (!Array.isArray(artists) || artists.length === 0) return '未知歌手';

    return artists.map(function(artist) {
      return artist && artist.name ? artist.name : '';
    }).filter(Boolean).join(' / ') || '未知歌手';
  }

  function formatPublishDate(timestamp) {
    if (!timestamp) return '发行时间未知';

    var date = new Date(timestamp);

    if (isNaN(date.getTime())) return '发行时间未知';

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  function createBackButtonHtml() {
    return (
      '<button type="button" class="btn btn-o search-detail-back" onclick="backToSearchResults()">' +
        '<i class="fas fa-arrow-left"></i>' +
        '<span>返回搜索结果</span>' +
      '</button>'
    );
  }

  function injectFeatureFixStyles() {
    if (document.getElementById('featureFixStyles')) return;

    var style = document.createElement('style');
    style.id = 'featureFixStyles';
    style.textContent = `
      .collapsible-card:not(.collapsed) .collapse-body {
        max-height: 2600px !important;
      }

      .search-entity-grid {
        align-items: stretch;
      }

      .search-entity-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        cursor: pointer;
      }

      .search-entity-card img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 10px;
        margin-bottom: 8px;
      }

      .search-entity-card .search-entity-name {
        color: var(--text-main);
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .search-entity-card .search-entity-meta {
        color: var(--text-secondary);
        font-size: 11px;
        line-height: 1.5;
        margin-top: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .search-detail-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;
        margin-bottom: 14px;
        background: var(--card-bg);
        backdrop-filter: var(--blur-val);
        -webkit-backdrop-filter: var(--blur-val);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius);
      }

      .search-detail-cover {
        width: 112px;
        height: 112px;
        object-fit: cover;
        border-radius: 14px;
        flex-shrink: 0;
      }

      .search-detail-copy {
        min-width: 0;
        flex: 1;
      }

      .search-detail-title {
        color: var(--text-main);
        font-size: 20px;
        font-weight: 700;
        line-height: 1.35;
      }

      .search-detail-subtitle {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.6;
        margin-top: 5px;
      }

      .search-detail-description {
        color: var(--text-secondary);
        font-size: 12px;
        line-height: 1.7;
        margin-top: 9px;
        white-space: pre-wrap;
      }

      .search-detail-back {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 12px;
      }

      .search-detail-section-title {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--text-main);
        font-size: 15px;
        font-weight: 600;
        margin: 16px 0 10px;
      }

      #cacheSettingEntry,
      #bgStatusText + button {
        min-width: 0;
      }

      @media (max-width: 700px) {
        .collapsible-card .ci > .cg {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .collapsible-card .ci > .cg > div {
          width: 100%;
          max-width: none !important;
        }

        .collapsible-card .ci > .cg > select,
        .collapsible-card .ci > .cg > button {
          width: 100%;
          max-width: none;
        }

        .collapsible-card .ci > .cg > div:last-child {
          justify-content: space-between;
        }

        #cacheSettingEntry {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        #cacheSettingEntry .cache-manage-button {
          width: 100%;
          justify-content: center;
        }

        .search-detail-header {
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .search-detail-cover {
          width: 132px;
          height: 132px;
        }

        .search-detail-copy {
          width: 100%;
        }
      }

      @media (max-height: 560px) and (orientation: landscape) {
        .modal {
          align-items: flex-start !important;
          overflow-y: auto;
          padding: 8px !important;
        }

        .modal .mc {
          max-height: none !important;
          margin: auto;
        }

        #cacheModal .mc {
          max-height: none !important;
          overflow: visible !important;
        }

        .cache-music-list {
          max-height: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectFeatureFixStyles();

  // ==================== 音频缓存跨域修复 ====================

  var nativeFetch = window.fetch.bind(window);

  function isNeteaseAudioUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      var hostname = parsed.hostname.toLowerCase();

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      return (
        hostname === 'music.126.net' ||
        hostname.endsWith('.music.126.net') ||
        hostname === 'music.163.com' ||
        hostname.endsWith('.music.163.com')
      );
    } catch (e) {
      return false;
    }
  }

  window.fetch = function(input, init) {
    var requestUrl = '';

    if (typeof input === 'string') {
      requestUrl = input;
    } else if (input && typeof input.url === 'string') {
      requestUrl = input.url;
    }

    if (requestUrl && isNeteaseAudioUrl(requestUrl)) {
      var proxyUrl =
        '/local/audio/proxy?url=' +
        encodeURIComponent(requestUrl);

      return nativeFetch(proxyUrl, init);
    }

    return nativeFetch(input, init);
  };

  // ==================== 搜索类型、分页与详情 ====================

  window.SEARCH_LIMIT = 30;
  window.searchState = {
    kw: '',
    type: 1,
    offset: 0,
    loading: false,
    hasMore: true
  };

  window.setSType = function(type, button) {
    window.sType = Number(type) || 1;

    document.querySelectorAll('.s-tabs button').forEach(function(item) {
      item.classList.remove('active');
    });

    if (button) button.classList.add('active');

    var labels = {
      1: '搜索歌曲...',
      10: '搜索专辑...',
      100: '搜索歌手...'
    };

    var input = document.getElementById('sIpt');

    if (input) {
      input.placeholder = labels[window.sType] || '搜索...';
    }

    var currentKeyword = getSearchInputValue();
    var resultSection = getSearchResultSection();
    var alreadySearched =
      window.searchState &&
      window.searchState.kw &&
      resultSection &&
      resultSection.style.display !== 'none';

    if (currentKeyword && alreadySearched) {
      window.sBtn();
    }
  };

  window.sBtn = function() {
    var keyword = getSearchInputValue();

    if (!keyword) return;

    var recommendation = document.getElementById('recSec');
    var resultSection = getSearchResultSection();
    var countElement = getSearchCountElement();
    var grid = getSearchGrid();

    if (recommendation) recommendation.style.display = 'none';
    if (resultSection) resultSection.style.display = 'block';
    if (countElement) countElement.textContent = '';

    if (grid) {
      grid.className = window.sType === 1 ? 's-list' : 'sg search-entity-grid';
      grid.innerHTML = '<div class="spin" style="margin:16px"></div>';
    }

    window.searchState = {
      kw: keyword,
      type: Number(window.sType) || 1,
      offset: 0,
      loading: false,
      hasMore: true
    };

    var sentinel = document.getElementById('searchSentinel');

    if (sentinel) sentinel.style.display = '';

    window.ensureSearchSentinel();
    window.loadSearchPage(true);
  };

  function updateSearchCount(result, type, loadedCount) {
    var countElement = getSearchCountElement();

    if (!countElement) return;

    var total = loadedCount;

    if (type === 1 && typeof result.songCount === 'number') {
      total = result.songCount;
    } else if (type === 10 && typeof result.albumCount === 'number') {
      total = result.albumCount;
    } else if (type === 100 && typeof result.artistCount === 'number') {
      total = result.artistCount;
    }

    var label = type === 1 ? '首歌曲' : type === 10 ? '张专辑' : '位歌手';
    countElement.textContent = '共 ' + total + ' ' + label;
  }

  function getSearchItems(result, type) {
    if (!result) return [];

    if (type === 10) return result.albums || [];
    if (type === 100) return result.artists || [];

    return result.songs || [];
  }

  function buildArtistResultsHtml(artists) {
    return artists.map(function(artist) {
      var id = safeNumericId(artist.id);
      var name = artist.name || '未知歌手';
      var image = artist.picUrl || artist.img1v1Url || '';
      var source = image ? image + '?param=300y300' : window.coverPlaceholder();
      var aliases = Array.isArray(artist.alias) && artist.alias.length > 0
        ? artist.alias.join(' / ')
        : '';
      var musicSize = Number(artist.musicSize) || 0;
      var albumSize = Number(artist.albumSize) || 0;
      var meta = [];

      if (aliases) meta.push(aliases);
      if (musicSize) meta.push(musicSize + ' 首歌曲');
      if (albumSize) meta.push(albumSize + ' 张专辑');

      return (
        '<div class="sc search-entity-card" onclick="openArtistDetail(' + id + ')">' +
          '<img src="' + window.escH(source) + '" alt="" loading="lazy" onerror="imgFallback(this)" />' +
          '<div class="search-entity-name">' + window.escH(name) + '</div>' +
          '<div class="search-entity-meta">' +
            window.escH(meta.join(' · ') || '点击查看歌手详情') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function buildAlbumResultsHtml(albums) {
    return albums.map(function(album) {
      var id = safeNumericId(album.id);
      var name = album.name || '未知专辑';
      var image = album.picUrl || album.blurPicUrl || '';
      var source = image ? image + '?param=300y300' : window.coverPlaceholder();
      var artistName = album.artist && album.artist.name
        ? album.artist.name
        : formatArtistNames(album.artists);
      var publishDate = formatPublishDate(album.publishTime);

      return (
        '<div class="sc search-entity-card" onclick="openAlbumDetail(' + id + ')">' +
          '<img src="' + window.escH(source) + '" alt="" loading="lazy" onerror="imgFallback(this)" />' +
          '<div class="search-entity-name">' + window.escH(name) + '</div>' +
          '<div class="search-entity-meta">' +
            window.escH(artistName + ' · ' + publishDate) +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function appendEntityResults(items, type, replace) {
    var grid = getSearchGrid();

    if (!grid) return;

    grid.className = 'sg search-entity-grid';

    var html = type === 10
      ? buildAlbumResultsHtml(items)
      : buildArtistResultsHtml(items);

    if (replace) {
      grid.innerHTML = html;
    } else {
      grid.insertAdjacentHTML('beforeend', html);
    }
  }

  window.loadSearchPage = function(isFirst) {
    var state = window.searchState;

    if (
      !state ||
      !state.kw ||
      state.loading ||
      !state.hasMore
    ) {
      return;
    }

    state.loading = true;

    if (!isFirst) window.showSearchMoreLoading(true);

    var requestPath =
      '/cloudsearch?keywords=' +
      encodeURIComponent(state.kw) +
      '&type=' +
      encodeURIComponent(state.type) +
      '&limit=' +
      window.SEARCH_LIMIT +
      '&offset=' +
      state.offset;

    window.fAPI(requestPath)
      .then(function(data) {
        if (window.searchState !== state) return;

        var result = data && data.result ? data.result : {};
        var items = getSearchItems(result, state.type);

        if (data.code !== 200 || items.length === 0) {
          state.hasMore = false;

          if (isFirst) {
            showSearchMessage('未找到相关结果');
          }

          return;
        }

        var previousOffset = state.offset;
        state.offset += items.length;

        updateSearchCount(result, state.type, state.offset);

        var totalCount = 0;

        if (state.type === 1) totalCount = Number(result.songCount) || 0;
        if (state.type === 10) totalCount = Number(result.albumCount) || 0;
        if (state.type === 100) totalCount = Number(result.artistCount) || 0;

        if (
          result.hasMore === false ||
          items.length < window.SEARCH_LIMIT ||
          (totalCount > 0 && state.offset >= totalCount)
        ) {
          state.hasMore = false;
        }

        if (state.type !== 1) {
          appendEntityResults(items, state.type, isFirst);
          return;
        }

        var ids = items.map(function(song) {
          return song.id;
        }).filter(function(id) {
          return id != null;
        }).join(',');

        if (!ids) {
          window.appendSong(items, 'resGrid', isFirst);
          return;
        }

        return window.fAPI('/song/detail?ids=' + encodeURIComponent(ids))
          .then(function(detailData) {
            if (window.searchState !== state) return;

            var songs =
              detailData &&
              detailData.code === 200 &&
              Array.isArray(detailData.songs)
                ? detailData.songs
                : items;

            var grid = getSearchGrid();

            if (grid) grid.className = 's-list';

            window.appendSong(songs, 'resGrid', isFirst);
          })
          .catch(function() {
            if (window.searchState !== state) return;

            var grid = getSearchGrid();

            if (grid) grid.className = 's-list';

            window.appendSong(items, 'resGrid', isFirst);
          })
          .then(function() {
            if (state.offset === previousOffset) {
              state.hasMore = false;
            }
          });
      })
      .catch(function() {
        if (window.searchState !== state) return;

        state.hasMore = false;

        if (isFirst) {
          showSearchMessage('搜索失败，请检查音乐 API 服务');
        }
      })
      .then(function() {
        if (window.searchState !== state) return;

        state.loading = false;
        window.showSearchMoreLoading(false);

        if (!state.hasMore) {
          window.stopSearchPaging();
        }
      });
  };

  window.backToSearchResults = function() {
    var keyword =
      window.searchState && window.searchState.kw
        ? window.searchState.kw
        : getSearchInputValue();

    if (!keyword) return;

    var input = document.getElementById('sIpt');

    if (input) input.value = keyword;

    window.sBtn();
  };

  window.openArtistDetail = function(id) {
    id = safeNumericId(id);

    if (!id) return;

    window.stopSearchPaging();

    var grid = getSearchGrid();
    var countElement = getSearchCountElement();

    if (countElement) countElement.textContent = '歌手详情';

    if (grid) {
      grid.className = 's-list';
      grid.innerHTML =
        createBackButtonHtml() +
        '<div style="display:flex;justify-content:center;padding:30px">' +
          '<div class="spin"></div>' +
        '</div>';
    }

    var detailRequest = window.fAPI('/artist/detail?id=' + id)
      .catch(function() {
        return null;
      });

    var songsRequest = window.fAPI(
      '/artist/songs?id=' + id + '&order=hot&limit=50&offset=0'
    )
      .catch(function() {
        return window.fAPI('/artists?id=' + id);
      })
      .catch(function() {
        return null;
      });

    var descriptionRequest = window.fAPI('/artist/desc?id=' + id)
      .catch(function() {
        return null;
      });

    Promise.all([
      detailRequest,
      songsRequest,
      descriptionRequest
    ]).then(function(results) {
      var detailData = results[0] || {};
      var songsData = results[1] || {};
      var descriptionData = results[2] || {};

      var artist =
        detailData.data && detailData.data.artist
          ? detailData.data.artist
          : detailData.artist || songsData.artist || {};

      var songs = Array.isArray(songsData.songs)
        ? songsData.songs
        : Array.isArray(songsData.hotSongs)
          ? songsData.hotSongs
          : [];

      var name = artist.name || '未知歌手';
      var image =
        artist.cover ||
        artist.avatar ||
        artist.picUrl ||
        artist.img1v1Url ||
        '';
      var source = image
        ? image + '?param=400y400'
        : window.coverPlaceholder();

      var aliases = Array.isArray(artist.alias) && artist.alias.length > 0
        ? artist.alias.join(' / ')
        : '';

      var description =
        artist.briefDesc ||
        descriptionData.briefDesc ||
        '';

      var meta = [];

      if (aliases) meta.push(aliases);
      if (artist.musicSize) meta.push(artist.musicSize + ' 首歌曲');
      if (artist.albumSize) meta.push(artist.albumSize + ' 张专辑');
      if (artist.mvSize) meta.push(artist.mvSize + ' 个 MV');

      var html =
        createBackButtonHtml() +
        '<div class="search-detail-header">' +
          '<img class="search-detail-cover" src="' +
            window.escH(source) +
            '" alt="" onerror="imgFallback(this)" />' +
          '<div class="search-detail-copy">' +
            '<div class="search-detail-title">' +
              window.escH(name) +
            '</div>' +
            '<div class="search-detail-subtitle">' +
              window.escH(meta.join(' · ') || '网易云音乐歌手') +
            '</div>' +
            (description
              ? '<div class="search-detail-description">' +
                  window.escH(description) +
                '</div>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="search-detail-section-title">' +
          '<i class="fas fa-fire" style="color:var(--primary)"></i>' +
          '热门歌曲' +
        '</div>';

      if (songs.length > 0) {
        html += window.buildSongItemsHtml(songs);
      } else {
        html +=
          '<div style="padding:20px;text-align:center;color:var(--text-secondary)">' +
            '暂未获取到该歌手的歌曲' +
          '</div>';
      }

      if (grid) {
        grid.className = 's-list';
        grid.innerHTML = html;
      }
    }).catch(function() {
      if (grid) {
        grid.className = 's-list';
        grid.innerHTML =
          createBackButtonHtml() +
          '<div style="padding:24px;text-align:center;color:var(--text-secondary)">' +
            '歌手详情加载失败' +
          '</div>';
      }
    });
  };

  window.openAlbumDetail = function(id) {
    id = safeNumericId(id);

    if (!id) return;

    window.stopSearchPaging();

    var grid = getSearchGrid();
    var countElement = getSearchCountElement();

    if (countElement) countElement.textContent = '专辑详情';

    if (grid) {
      grid.className = 's-list';
      grid.innerHTML =
        createBackButtonHtml() +
        '<div style="display:flex;justify-content:center;padding:30px">' +
          '<div class="spin"></div>' +
        '</div>';
    }

    window.fAPI('/album?id=' + id)
      .then(function(data) {
        if (!data || data.code !== 200 || !data.album) {
          throw new Error('专辑详情不可用');
        }

        var album = data.album;
        var songs = Array.isArray(data.songs) ? data.songs : [];
        var name = album.name || '未知专辑';
        var image = album.picUrl || album.blurPicUrl || '';
        var source = image
          ? image + '?param=400y400'
          : window.coverPlaceholder();
        var artistName = album.artist && album.artist.name
          ? album.artist.name
          : formatArtistNames(album.artists);

        var description =
          album.description ||
          album.briefDesc ||
          '';

        var meta = [
          artistName,
          formatPublishDate(album.publishTime)
        ];

        if (album.size) meta.push(album.size + ' 首歌曲');
        if (album.company) meta.push(album.company);

        var html =
          createBackButtonHtml() +
          '<div class="search-detail-header">' +
            '<img class="search-detail-cover" src="' +
              window.escH(source) +
              '" alt="" onerror="imgFallback(this)" />' +
            '<div class="search-detail-copy">' +
              '<div class="search-detail-title">' +
                window.escH(name) +
              '</div>' +
              '<div class="search-detail-subtitle">' +
                window.escH(meta.join(' · ')) +
              '</div>' +
              (description
                ? '<div class="search-detail-description">' +
                    window.escH(description) +
                  '</div>'
                : '') +
            '</div>' +
          '</div>' +
          '<div class="search-detail-section-title">' +
            '<i class="fas fa-compact-disc" style="color:var(--primary)"></i>' +
            '专辑歌曲' +
          '</div>';

        if (songs.length > 0) {
          html += window.buildSongItemsHtml(songs);
        } else {
          html +=
            '<div style="padding:20px;text-align:center;color:var(--text-secondary)">' +
              '该专辑暂无可显示的歌曲' +
            '</div>';
        }

        if (grid) {
          grid.className = 's-list';
          grid.innerHTML = html;
        }
      })
      .catch(function() {
        if (grid) {
          grid.className = 's-list';
          grid.innerHTML =
            createBackButtonHtml() +
            '<div style="padding:24px;text-align:center;color:var(--text-secondary)">' +
              '专辑详情加载失败' +
            '</div>';
        }
      });
  };

  // ==================== 网易云 Cookie 云端同步 ====================

  window.pushUserData = function() {
    if (!window.currentUser) return;

    if (window.syncTimer) clearTimeout(window.syncTimer);

    window.syncTimer = setTimeout(function() {
      var ncCookie = localStorage.getItem(window.ncKey) || '';

      fetch('/user/data', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history: window.playHistory,
          favorites: window.myFavorites,
          playlists: window.customPlaylists,
          ncCookie: ncCookie
        })
      }).catch(function() {});
    }, 800);
  };

  window.initAuth = function() {
    window.renderUserCard();

    window.fetchMe().then(function(user) {
      if (!user) return;

      window.currentUser = user;
      window.renderUserCard();

      window.pullUserData().then(function(remote) {
        if (remote) {
          window.playHistory = window.mergeById(
            window.playHistory,
            remote.history
          ).slice(0, 100);

          window.myFavorites = window.mergeById(
            window.myFavorites,
            remote.favorites
          );

          window.customPlaylists = window.mergePlaylists(
            window.customPlaylists,
            remote.playlists
          );

          localStorage.setItem(
            'my_history',
            JSON.stringify(window.playHistory)
          );
          localStorage.setItem(
            'my_favorites',
            JSON.stringify(window.myFavorites)
          );
          localStorage.setItem(
            'my_playlists',
            JSON.stringify(window.customPlaylists)
          );

          var remoteCookie =
            typeof remote.ncCookie === 'string'
              ? remote.ncCookie.trim()
              : '';

          if (remoteCookie) {
            localStorage.setItem(window.ncKey, remoteCookie);

            var cookieInput = document.getElementById('ncCookie');
            var savedLabel = document.getElementById('ncSaved');

            if (cookieInput) cookieInput.value = remoteCookie;
            if (savedLabel) savedLabel.style.display = 'inline';
          }
        }

        window.pushUserData();

        if (window.currentPage === 'mine') {
          var button = document.querySelector('#mineTabs button');
          window.setMineTab('history', button);
        }
      });
    });
  };

  var originalSaveCookie = window.saveCookie;

  window.saveCookie = function(type) {
    if (typeof originalSaveCookie === 'function') {
      originalSaveCookie(type);
    }

    if (type === 'nc') {
      window.pushUserData();
    }
  };

  window.pollQR = function(key) {
    if (window.qrTimer) clearTimeout(window.qrTimer);

    window.fAPI(
      '/login/qr/check?key=' +
      encodeURIComponent(key) +
      '&timestamp=' +
      Date.now()
    ).then(function(data) {
      if (data.code === 803) {
        var cookie = data.cookie || '';
        var input = document.getElementById('ncCookie');
        var saved = document.getElementById('ncSaved');
        var message = document.getElementById('qrMsg');

        if (input) input.value = cookie;
        localStorage.setItem(window.ncKey, cookie);
        if (saved) saved.style.display = cookie ? 'inline' : 'none';
        if (message) message.textContent = '登录成功！Cookie 已保存并同步';

        window.pushUserData();

        setTimeout(function() {
          var modal = document.getElementById('qrModal');
          if (modal) modal.classList.remove('show');
        }, 1500);
      } else if (data.code === 802) {
        document.getElementById('qrMsg').textContent =
          '已扫码，确认登录中...';

        window.qrTimer = setTimeout(function() {
          window.pollQR(key);
        }, 1500);
      } else if (data.code === 801) {
        document.getElementById('qrMsg').textContent =
          '请使用网易云音乐 App 扫码';

        window.qrTimer = setTimeout(function() {
          window.pollQR(key);
        }, 2000);
      } else if (data.code === 800) {
        document.getElementById('qrMsg').textContent =
          '二维码已过期，请重新获取';
      } else {
        window.qrTimer = setTimeout(function() {
          window.pollQR(key);
        }, 2000);
      }
    }).catch(function() {
      window.qrTimer = setTimeout(function() {
        window.pollQR(key);
      }, 3000);
    });
  };

  // ==================== 壁纸刷新稳定性修复 ====================

  var wallpaperRequestToken = 0;
  var lastWallpaperUrl = '';

  function setWallpaperButtonLoading(loading) {
    var status = document.getElementById('bgStatusText');
    var row = status ? status.closest('.cg') : null;
    var button = row ? row.querySelector('button') : null;

    if (!button) return;

    button.disabled = loading;
    button.style.opacity = loading ? '0.55' : '';
    button.style.cursor = loading ? 'wait' : 'pointer';

    button.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i> 正在刷新'
      : '<i class="fas fa-sync-alt"></i> 刷新壁纸';
  }

  window.initBg = function() {
    var token = ++wallpaperRequestToken;
    var width = window.innerWidth || window.screen.width || 1920;
    var height = window.innerHeight || window.screen.height || 1080;
    var isVertical = height > width;
    var orientation = isVertical ? 'vertical' : 'horizontal';
    var fallbackUrl =
      'https://picsum.photos/' +
      (isVertical ? '1080/1920' : '1920/1080') +
      '?random=' +
      Date.now();

    window.updateBgStatus('正在获取匹配当前屏幕比例的壁纸...', false);
    setWallpaperButtonLoading(true);

    nativeFetch(
      '/local/wallpaper/list?orientation=' +
      encodeURIComponent(orientation) +
      '&timestamp=' +
      Date.now(),
      {
        credentials: 'same-origin',
        cache: 'no-store'
      }
    )
      .then(function(response) {
        if (!response.ok) {
          throw new Error('壁纸 API 异常');
        }

        return response.json();
      })
      .then(function(result) {
        if (token !== wallpaperRequestToken) return;

        if (
          result.code !== 200 ||
          !Array.isArray(result.data) ||
          result.data.length === 0
        ) {
          throw new Error('未找到合适的壁纸文件');
        }

        var candidates = result.data.filter(function(item) {
          return item && item.url && item.url !== lastWallpaperUrl;
        });

        if (candidates.length === 0) {
          candidates = result.data.slice();
        }

        var selected =
          candidates[Math.floor(Math.random() * candidates.length)];

        var screenRatio = width / height;
        var imageRatio = selected.width / selected.height;
        var fitFactor = Math.max(
          imageRatio / screenRatio,
          screenRatio / imageRatio
        );

        lastWallpaperUrl = selected.url;
        window.setBg(selected.url);

        window.updateBgStatus(
          '✅ 已刷新壁纸：' +
          selected.name +
          ' (' +
          selected.width +
          'x' +
          selected.height +
          '，比例偏离 ' +
          ((fitFactor - 1) * 100).toFixed(0) +
          '%)',
          false
        );
      })
      .catch(function(error) {
        if (token !== wallpaperRequestToken) return;

        console.error('壁纸加载失败，使用随机兜底图：', error);
        lastWallpaperUrl = fallbackUrl;
        window.setBg(fallbackUrl);
        window.updateBgStatus(
          '本地壁纸加载失败，已切换到随机兜底壁纸',
          true
        );
      })
      .then(function() {
        if (token === wallpaperRequestToken) {
          setWallpaperButtonLoading(false);
        }
      });
  };
})();
