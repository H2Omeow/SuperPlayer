// ==================== 画中画歌词悬浮窗 ====================
// 原理：用 Canvas 绘制歌词帧 → captureStream() → 隐藏 <video> → requestPictureInPicture()
// 歌词数据直接复用 window.lyrics（由 player.js 的 fLrc/renderParsedLrc 维护），无需重复请求。

(function () {
  'use strict';

  var pip = {
    active: false,
    canvas: null,
    ctx: null,
    video: null,
    animFrame: null
  };

  // ==================== 初始化 Canvas / Video ====================
  function initPip() {
    if (pip.canvas) return; // 只初始化一次

    var canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 200;
    pip.canvas = canvas;
    pip.ctx = canvas.getContext('2d');

    // 先绘制一帧，避免 captureStream 拿到空 canvas
    drawBlank();

    // 隐藏的 video 元素（PiP API 必须基于 DOM 内的 video）
    var video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = [
      'position:fixed',
      'width:1px',
      'height:1px',
      'left:-200px',
      'top:0',
      'opacity:0.01',
      'pointer-events:none',
      'z-index:-1'
    ].join(';');
    document.body.appendChild(video);
    pip.video = video;

    // 将 canvas 流绑定到 video
    video.srcObject = canvas.captureStream(30);

    // 用户关闭 PiP 窗口时重置状态
    video.addEventListener('leavepictureinpicture', function () {
      pip.active = false;
      if (pip.animFrame) {
        cancelAnimationFrame(pip.animFrame);
        pip.animFrame = null;
      }setBtnState(false);
    });
  }

  // ==================== 绘制初始空白帧 ====================
  function drawBlank() {
    var ctx = pip.ctx;
    var W = pip.canvas.width;
    var H = pip.canvas.height;
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);
  }

  // ==================== 文本溢出截断 ====================
  function truncate(ctx, text, maxW) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1&& ctx.measureText(text + '\u2026').width > maxW) {
      text = text.slice(0, -1);
    }
    return text + '\u2026';
  }

  // ==================== 核心帧渲染循环 ====================
  function drawFrame() {
    if (!pip.active) return;

    var ctx = pip.ctx;
    var W = pip.canvas.width;
    var H = pip.canvas.height;
    var lyr = window.lyrics || [];

    // 背景
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);

    // 顶部 / 底部装饰渐变线
    var hGrad = ctx.createLinearGradient(0, 0, W, 0);
    hGrad.addColorStop(0, 'transparent');
    hGrad.addColorStop(0.25, '#f31260');
    hGrad.addColorStop(0.75, '#f31260');
    hGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, W, 2);
    ctx.fillRect(0, H - 2, W, 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 无歌词时显示提示
    if (lyr.length === 0) {
      ctx.globalAlpha = 0.45;
      ctx.font = '18px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('暂无歌词', W / 2, H / 2);
      ctx.globalAlpha = 1;
      pip.animFrame = requestAnimationFrame(drawFrame);
      return;
    }

    // 找出当前歌词索引
    var audio = document.getElementById('aPlayer');
    var ct = audio ? audio.currentTime : 0;
    var curIdx = 0;
    for (var i = lyr.length - 1; i >= 0; i--) {
      if (lyr[i].time <= ct) { curIdx = i; break; }
    }

    var curLyric = lyr[curIdx];
    var curHasTrans = !!(curLyric && curLyric.t);

    // 三行槽位：上一句、当前句、下一句
    var slots = [
      { idx: curIdx - 1, alpha: 0.38, isCur: false },
      { idx: curIdx,     alpha: 1.0,  isCur: true  },
      { idx: curIdx + 1, alpha: 0.38, isCur: false }
    ];

    // 根据当前句是否有翻译，动态调整三行的纵向位置
    var yPcts = curHasTrans ? [0.16, 0.50, 0.85] : [0.22, 0.50, 0.78];

    slots.forEach(function (slot, si) {
      var lyric = lyr[slot.idx];
      if (!lyric) return;

      ctx.globalAlpha = slot.alpha;

      var mainSize = slot.isCur ? 22 : 15;
      var mainY = H * yPcts[si];

      // 当前行若有翻译，主文本向上偏移为译文留空间
      if (slot.isCur && curHasTrans) {
        mainY -= (mainSize + 6) / 2;
      }

      // 主歌词字体
      ctx.font = (slot.isCur ? 'bold ' : '') + mainSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';

      if (slot.isCur) {
        ctx.shadowColor = 'rgba(243,18,96,0.75)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#b0b0b0';
      }

      ctx.fillText(truncate(ctx, lyric.text, W - 80), W / 2, mainY);
      ctx.shadowBlur = 0;

      // 翻译行（仅当lyric.t 存在时）
      if (lyric.t) {
        var transSize = slot.isCur ? 14 : 11;
        ctx.font = transSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillStyle = slot.isCur ? '#f9a8c9' : '#777777';
        ctx.fillText(truncate(ctx, lyric.t, W - 80), W / 2, mainY + mainSize + 7);
      }
    });

    ctx.globalAlpha = 1;
    pip.animFrame = requestAnimationFrame(drawFrame);
  }

  // ==================== 更新按钮高亮状态 ====================
  function setBtnState(active) {
    ['pipLyricsBtn', 'fpPipLyricsBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.style.color = active ? 'var(--primary)' : '';
      btn.title = active ? '关闭歌词悬浮窗' : '歌词悬浮窗（画中画）';
    });
  }

  // ==================== 主开关（对外暴露） ====================
  window.toggleLyricsPiP = async function () {
    // 功能支持检测
    if (!document.pictureInPictureEnabled) {
      window.toast('当前浏览器不支持画中画功能（请使用 Chrome 或 Edge）');
      return;
    }
    if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
      window.toast('当前浏览器不支持 captureStream，无法启用歌词悬浮窗');
      return;
    }

    // 已开启 → 退出
    if (document.pictureInPictureElement) {
      try { await document.exitPictureInPicture(); } catch (e) {}
      return;
    }

    // 未在播放任何歌曲
    if (!window.list || window.list.length === 0 || window.idx < 0) {
      window.toast('请先播放一首歌曲');
      return;
    }

    initPip();
    pip.active = true;

    // 渲染第一帧（进入 PiP 前canvas 需有内容，避免空白窗口）
    drawFrame();
    if (pip.animFrame) { cancelAnimationFrame(pip.animFrame); pip.animFrame = null; }

    try {
      await pip.video.play();
      await pip.video.requestPictureInPicture();
      // 成功进入 PiP 后正式启动渲染循环
      pip.active = true;
      drawFrame();
      setBtnState(true);
      window.toast('歌词悬浮窗已开启');
    } catch (e) {
      pip.active = false;
      console.error('[PiP歌词] 启动失败:', e);
      if (e.name !== 'AbortError') {
        window.toast('启动失败：' + (e.message || '请检查浏览器权限'));
      }
    }
  };

})();
