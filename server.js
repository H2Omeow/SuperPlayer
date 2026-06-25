import express from 'express';
import serveIndex from 'serve-index';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sizeOf from 'image-size'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4096;

// ==================== 壁纸缓存与尺寸计算系统 ====================
const wallpapers = { horizontal: [], vertical: [] };
let wallpaperPath = '/data/wallpaper';

if (!fs.existsSync(wallpaperPath)) {
    wallpaperPath = path.join(__dirname, 'data/wallpaper'); // 兼容本地测试
}
console.log(`[壁纸模块] 正在从物理路径加载壁纸: ${wallpaperPath}`);

// 预初始化读取壁纸分辨率缓存
function initWallpapers() {
    if (!fs.existsSync(wallpaperPath)) {
        console.log(`[壁纸模块] 错误：目录不存在 -> ${wallpaperPath}`);
        return;
    }
    const files = fs.readdirSync(wallpaperPath);
    
    // 提取解析函数，兼容 ESM
    const sizeFn = typeof sizeOf === 'function' ? sizeOf : (sizeOf.default || sizeOf.imageSize);
    if (typeof sizeFn !== 'function') {
        console.log("[壁纸模块] 致命错误：image-size 模块未能成功加载。");
        return;
    }

    files.forEach(file => {
        if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) return;
        try {
            const filePath = path.join(wallpaperPath, file);
            
            // 使用原生 fs 读取为 Buffer，避开 image-size 的流式读取 BUG
            const buffer = fs.readFileSync(filePath);
            
            // 拦截 0 字节的损坏文件
            if (buffer.length === 0) {
                throw new Error("文件为空 (0字节)");
            }

            // 直接解析 Buffer
            const dimensions = sizeFn(buffer);
            const isHorizontal = dimensions.width > dimensions.height;
            const item = { 
                name: file, 
                url: `/data/wallpaper/${encodeURIComponent(file)}`,
                width: dimensions.width,
                height: dimensions.height
            };
            
            if (isHorizontal) wallpapers.horizontal.push(item);
            else wallpapers.vertical.push(item);
        } catch (e) {
            console.warn(`[壁纸模块] 跳过解析: ${file} | 原因: ${e.message || e}`);
        }
    });
    console.log(`[壁纸模块] 预载完毕! 横屏: ${wallpapers.horizontal.length}张, 竖屏: ${wallpapers.vertical.length}张`);
}
initWallpapers();

const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

app.use(express.static(staticDir));

// 新增 API：前端请求对应比例的壁纸
app.get('/local/wallpaper/list', (req, res) => {
    const orientation = req.query.orientation || 'horizontal';
    const list = wallpapers[orientation].length > 0 ? wallpapers[orientation] : wallpapers.horizontal;
    res.json({ code: 200, data: list });
});

app.use('/data/wallpaper', express.static(wallpaperPath), serveIndex(wallpaperPath, { 'icons': true, 'view': 'details' }));

app.get('*', (req, res) => {
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('Not Found');
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`超级播放器已成功启动！http://localhost:${PORT}`);
    console.log(`=================================`);
});