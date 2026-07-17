import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import sessionFileStoreFactory from 'session-file-store';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import serveIndex from 'serve-index';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sizeOf from 'image-size';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4096;
const ACCOUNT_CENTER = 'https://account.nekoh2o.top';

// ==================== 启动前校验关键密钥 ====================
if (!process.env.JWT_SECRET) console.warn('[SSO] 警告：未配置 JWT_SECRET，回跳校验会失败');
if (!process.env.DATA_ENC_KEY || process.env.DATA_ENC_KEY.length < 64) {
    console.warn('[数据] 警告：DATA_ENC_KEY 缺失或不足 32 字节(hex)，加密存储不可用');
}

// ==================== 数据目录与会话存储 ====================
const dataRoot = process.env.DATA_ROOT || path.join(__dirname, 'data');
const userDataDir = path.join(dataRoot, 'userdata');
const sessionsDir = path.join(dataRoot, 'sessions');
fs.mkdirSync(userDataDir, { recursive: true });
fs.mkdirSync(sessionsDir, { recursive: true });

const FileStore = sessionFileStoreFactory(session);

app.set('trust proxy', 1); // 位于 nginx 反代之后
app.use(session({
    name: 'sp.sid',
    store: new FileStore({ path: sessionsDir, retries: 1, ttl: 7 * 24 * 3600 }),
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 7 * 24 * 3600 * 1000
    }
}));

// ==================== 播放数据静态加密 (AES-256-GCM，每用户独立密钥) ====================
function deriveKey(userId) {
    const master = Buffer.from(process.env.DATA_ENC_KEY, 'hex');
    return Buffer.from(crypto.hkdfSync('sha256', master, Buffer.from(String(userId)), Buffer.from('playerdata'), 32));
}
function encryptData(userId, plaintext) {
    const key = deriveKey(userId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decryptData(userId, b64) {
    const raw = Buffer.from(b64, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const key = deriveKey(userId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function safeId(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function userFile(id) { return path.join(userDataDir, safeId(id) + '.enc'); }
function readUserData(id) {
    try {
        const f = userFile(id);
        if (!fs.existsSync(f)) return { history: [], favorites: [], playlists: [], ncCookie: '' };
        const data = JSON.parse(decryptData(id, fs.readFileSync(f, 'utf8')));
        if (typeof data.ncCookie !== 'string') data.ncCookie = '';
        return data;
    } catch (e) {
        console.warn('[数据] 读取失败:', e.message);
        return { history: [], favorites: [], playlists: [], ncCookie: '' };
    }
}
function writeUserData(id, obj) {
    try { fs.writeFileSync(userFile(id), encryptData(id, JSON.stringify(obj))); }
    catch (e) { console.error('[数据] 写入失败:', e.message); }
}

// ==================== 统一鉴权：网页用 session，App 用 Bearer token ====================
function resolveUser(req) {
    // 网页：express-session
    if (req.session && req.session.user) {
        return { user: req.session.user, ssoToken: req.session.ssoToken };
    }
    // App：Authorization: Bearer <ssoToken>
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
        const token = auth.slice(7);
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            return {
                user: { id: payload.id, username: payload.username, email: payload.email },
                ssoToken: token
            };
        } catch (e) { return null; }
    }
    return null;
}

// ==================== 壁纸缓存与尺寸计算系统 ====================
const wallpapers = { horizontal: [], vertical: [] };
let wallpaperPath = '/data/wallpaper';

if (!fs.existsSync(wallpaperPath)) {
    wallpaperPath = path.join(__dirname, 'data/wallpaper');
}
console.log(`[壁纸模块] 正在从物理路径加载壁纸: ${wallpaperPath}`);

function initWallpapers() {
    if (!fs.existsSync(wallpaperPath)) {
        console.log(`[壁纸模块] 错误：目录不存在 -> ${wallpaperPath}`);
        return;
    }
    const files = fs.readdirSync(wallpaperPath);
    const sizeFn = typeof sizeOf === 'function' ? sizeOf : (sizeOf.default || sizeOf.imageSize);
    if (typeof sizeFn !== 'function') {
        console.log("[壁纸模块] 致命错误：image-size 模块未能成功加载。");
        return;
    }
    files.forEach(file => {
        if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) return;
        try {
            const filePath = path.join(wallpaperPath, file);
            const buffer = fs.readFileSync(filePath);
            if (buffer.length === 0) throw new Error("文件为空 (0字节)");
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

// ==================== SSO 单点登录路由 ====================
app.get('/auth/sso/callback', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).send('缺少登录凭证');
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.session.user = { id: payload.id, username: payload.username, email: payload.email };
        req.session.ssoToken = token;
        try {
            const r = await fetch(ACCOUNT_CENTER + '/api/userinfo', { headers: { Authorization: 'Bearer ' + token } });
            const data = await r.json();
            if (data.code === 0) req.session.user = data.user;
        } catch (e) { /* 忽略 */ }
        // 给原生 App 一份可读的 token（非 HttpOnly），网页端忽略
        res.cookie('app_token', token, {
            httpOnly: false,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax',
            maxAge: 7 * 24 * 3600 * 1000
        });
        req.session.save(() => res.redirect('/'));
    } catch (e) {
        res.status(401).send('登录凭证无效或已过期，请重新登录');
    }
});

app.get('/auth/sso/me', async (req, res) => {
    const ctx = resolveUser(req);
    if (!ctx) return res.status(401).json({ code: 401, msg: '未登录' });
    try {
        const r = await fetch(ACCOUNT_CENTER + '/api/userinfo', { headers: { Authorization: 'Bearer ' + ctx.ssoToken } });
        const data = await r.json();
        if (data.code === 0) {
            if (req.session) req.session.user = data.user;
            return res.json({ code: 0, user: data.user });
        }
        if (data.code === 401) {
            if (req.session) req.session.destroy(() => {});
            return res.status(401).json({ code: 401, msg: '登录已过期' });
        }
        return res.json({ code: 0, user: ctx.user });
    } catch (e) {
        return res.json({ code: 0, user: ctx.user });
    }
});

app.post('/auth/sso/logout', (req, res) => {
    if (req.session) req.session.destroy(() => {});
    res.clearCookie('sp.sid');
    res.clearCookie('app_token');
    res.json({ code: 0 });
});

// ==================== 用户播放数据（加密存储，需登录） ====================
app.get('/user/data', (req, res) => {
    const ctx = resolveUser(req);
    if (!ctx) return res.status(401).json({ code: 401, msg: '未登录' });
    res.json({ code: 0, data: readUserData(ctx.user.id) });
});

app.put('/user/data', express.json({ limit: '8mb' }), (req, res) => {
    const ctx = resolveUser(req);
    if (!ctx) return res.status(401).json({ code: 401, msg: '未登录' });
    const body = req.body || {};
    const clean = {
        history: Array.isArray(body.history) ? body.history.slice(0, 100) : [],
        favorites: Array.isArray(body.favorites) ? body.favorites : [],
        playlists: Array.isArray(body.playlists) ? body.playlists : [],
        ncCookie: typeof body.ncCookie === 'string' ? body.ncCookie : ''
    };
    writeUserData(ctx.user.id, clean);
    res.json({ code: 0 });
});

// ==================== 壁纸接口 ====================
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
