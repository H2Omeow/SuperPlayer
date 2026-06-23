import express from 'express';
import serveIndex from 'serve-index';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4096; // 网页访问端口，可自行修改

// 生产模式：优先服务 Vite 构建的 dist/ 目录
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

console.log(`[静态服务] 根目录: ${staticDir}`);

// 1. 提供前端静态文件服务
app.use(express.static(staticDir));

// 2. 智能兼容壁纸路径：优先使用 Linux 系统根目录下的绝对路径 /data/wallpaper
let wallpaperPath = '/data/wallpaper';
if (!fs.existsSync(wallpaperPath)) {
    // 兼容本地测试环境
    wallpaperPath = path.join(__dirname, 'data/wallpaper');
}

console.log(`[壁纸模块] 正在从物理路径加载壁纸: ${wallpaperPath}`);

// 3. 完美映射并启用目录浏览
app.use('/data/wallpaper',
    express.static(wallpaperPath),
    serveIndex(wallpaperPath, { 'icons': true, 'view': 'details' })
);

// SPA fallback: 所有非静态请求回退到 index.html
app.get('*', (req, res) => {
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`超级播放器已成功启动！`);
    console.log(`请在浏览器访问: http://localhost:${PORT}`);
    console.log(`=================================`);
});
