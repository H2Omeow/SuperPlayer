// ==================== 入口文件 ====================
// 导入 CSS
import './css/main.css';

// 按依赖顺序导入 JS 模块（作为副作用导入，每个模块向 window 注册其函数/变量）
import './js/state.js';    // 全局状态变量（无依赖）
import './js/core.js';     // 核心工具函数（依赖 state）
import './js/ui.js';       // UI 函数（依赖 state, core）
import './js/auth.js';     // SSO 登录 / 数据同步（依赖 state, core, ui）
import './js/theme.js';    // 主题/壁纸函数（依赖 state）
import './js/api.js';      // 搜索/API 函数（依赖 state, core, ui）
import './js/player.js';   // 播放器兼容入口，实际加载 tmp/player.js

// 在 feature-fixes.js 包装 window.fetch 之前保存浏览器原生 Fetch。
import './js/native-fetch.js';

import './js/cache.js';    // 音乐缓存与播放全部功能（依赖 player）
import './js/lyrics-pip.js'; // Canvas 视频流画中画歌词（依赖 player, ui）
import './js/feature-fixes.js'; // 搜索、Cookie 同步及响应式兼容修复

// 修复卡片与“我的”页面，加入主页工具、持久化开关及歌曲下载。
import './js/player-enhancements.js';

import './js/init.js';     // DOM 初始化（依赖所有模块）
