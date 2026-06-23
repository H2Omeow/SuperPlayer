// ==================== 入口文件 ====================
// 导入 CSS
import './css/main.css';

// 按依赖顺序导入 JS 模块（作为副作用导入，每个模块向 window 注册其函数/变量）
import './js/state.js';    // 全局状态变量（无依赖）
import './js/core.js';     // 核心工具函数（依赖 state）
import './js/ui.js';       // UI 函数（依赖 state, core）
import './js/theme.js';    // 主题/壁纸函数（依赖 state）
import './js/api.js';      // 搜索/API 函数（依赖 state, core, ui）
import './js/player.js';   // 播放器函数（依赖 state, core, ui）
import './js/init.js';     // DOM 初始化（依赖所有模块）
