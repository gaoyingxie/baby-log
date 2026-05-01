/**
 * 宝宝成长记录 - NAS 本地服务器（零依赖版）
 * 使用 Node.js 内置模块，无需 npm install！
 * 数据存储在 JSON 文件，直接落 NAS 硬盘。
 * 支持 /api/update 自动拉取 GitHub 代码更新。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const DATA_FILE = path.join(DATA_DIR, 'baby-log.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPDATE_SECRET = process.env.UPDATE_TOKEN || 'baby-log-update';
  // 使用 codeload.github.com 直接下载，避免 GitHub 的 302 重定向
  const DOWNLOAD_URL = 'https://codeload.github.com/gaoyingxie/baby-log/tar.gz/refs/heads/nas-server';

// ========== 数据库（JSON 文件）==========
let db = { users: [], records: [], nextUserId: 1 };

function loadDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      console.log(`📂 已加载数据库: ${DATA_FILE}`);
    } else {
      console.log('📋 数据库不存在，将创建新的');
      saveDb();
    }
  } catch (e) {
    console.error('⚠️ 数据库加载失败:', e.message);
  }
}

function saveDb() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ 保存数据库失败:', e.message);
  }
}

// ========== HTTP 工具函数 ==========
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('无效的 JSON')); } });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath) {
  const extMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  };
  const ext = path.extname(filePath);
  const ct = extMap[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const idx = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(idx, (e2, d2) => {
        if (e2) return jsonResponse(res, 404, { error: 'Not found' });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
}

// 带重定向跟随的下载
function downloadFile(urlStr, destPath) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('↪️ 重定向到:', res.headers.location);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`下载失败: HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(resolve); });
    }).on('error', reject);
  });
}

// ========== 自动更新 ==========
async function doUpdate(res) {
  try {
    console.log('🔄 开始自动更新...');
    const tmpFile = '/tmp/baby-log-update.tar.gz';
    await downloadFile(DOWNLOAD_URL, tmpFile);
    console.log('✅ 下载完成');

    execSync(`tar xzf ${tmpFile} -C /tmp/`);
    const dirs = fs.readdirSync('/tmp/').filter(d => d.startsWith('baby-log-'));
    if (dirs.length === 0) throw new Error('未找到解压目录');
    const srcDir = '/tmp/' + dirs.sort().pop();
    console.log('📦 解压:', srcDir);

    execSync(`cp ${srcDir}/server.js /app/server.js`);
    execSync(`cp -r ${srcDir}/public/* /app/public/ 2>/dev/null; true`);

    fs.rmSync(tmpFile, { force: true });
    execSync(`rm -rf ${srcDir}`);
    console.log('✅ 代码已更新');

    jsonResponse(res, 200, { success: true, message: '✅ 更新成功，正在重启...' });
    console.log('🔄 即将重启...');
    setTimeout(() => process.exit(0), 1000);
  } catch (e) {
    console.error('❌ 更新失败:', e.message);
    try { jsonResponse(res, 500, { error: '更新失败: ' + e.message }); } catch {}
  }
}

// ========== API 路由 ==========
async function handleApi(req, res, pathname, query) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  try {
    // 健康检查
    if (pathname === '/api/health' && req.method === 'GET') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    // 自动更新
    if (pathname === '/api/update' && req.method === 'GET') {
      if ((query.token || '') !== UPDATE_SECRET) {
        return jsonResponse(res, 403, { error: '无效的更新令牌' });
      }
      doUpdate(res);
      return;
    }

    // 用户搜索
    if (pathname === '/api/users/search' && req.method === 'GET') {
      if (!query.name) return jsonResponse(res, 400, { error: '缺少名字' });
      const user = db.users.find(u => u.name === query.name);
      return jsonResponse(res, 200, user ? [user] : []);
    }

    // 创建用户
    if (pathname === '/api/users' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) return jsonResponse(res, 400, { error: '缺少名字' });
      if (db.users.find(u => u.name === body.name)) {
        return jsonResponse(res, 409, { error: '这个名字已被注册' });
      }
      const user = { id: db.nextUserId++, name: body.name, birthday: body.birthday || null, gender: body.gender || 'boy', created_at: new Date().toISOString() };
      db.users.push(user);
      saveDb();
      return jsonResponse(res, 201, [user]);
    }

    // 更新用户
    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && req.method === 'PUT') {
      const userId = parseInt(userMatch[1]);
      const body = await parseBody(req);
      const idx = db.users.findIndex(u => u.id === userId);
      if (idx < 0) return jsonResponse(res, 404, { error: '用户不存在' });
      if (body.name !== undefined) db.users[idx].name = body.name;
      if (body.birthday !== undefined) db.users[idx].birthday = body.birthday;
      if (body.gender !== undefined) db.users[idx].gender = body.gender;
      saveDb();
      return jsonResponse(res, 200, { success: true });
    }

    // 获取记录
    if (pathname === '/api/records' && req.method === 'GET') {
      const userId = parseInt(query.user_id);
      if (!userId) return jsonResponse(res, 400, { error: '缺少 user_id' });
      const records = db.records.filter(r => r.user_id === userId).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 500);
      return jsonResponse(res, 200, records);
    }

    // 添加记录
    if (pathname === '/api/records' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.id || !body.user_id || !body.type) return jsonResponse(res, 400, { error: '缺少必要字段' });
      db.records.push({ id: body.id, user_id: body.user_id, type: body.type, time: body.time || new Date().toISOString(), amount: body.amount || null, created_at: new Date().toISOString() });
      saveDb();
      return jsonResponse(res, 201, { success: true });
    }

    // 批量导入
    if (pathname === '/api/records/batch' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!Array.isArray(body)) return jsonResponse(res, 400, { error: '需要数组' });
      for (const r of body) {
        const idx = db.records.findIndex(x => x.id === r.id);
        if (idx >= 0) db.records[idx] = { ...r, amount: r.amount || null };
        else db.records.push({ ...r, amount: r.amount || null });
      }
      saveDb();
      return jsonResponse(res, 200, { success: true, count: body.length });
    }

    // 修改记录
    const recMatch = pathname.match(/^\/api\/records\/([\w-]+)$/);
    if (recMatch && req.method === 'PUT') {
      const body = await parseBody(req);
      const idx = db.records.findIndex(r => r.id === recMatch[1]);
      if (idx < 0) return jsonResponse(res, 404, { error: '记录不存在' });
      if (body.time !== undefined) db.records[idx].time = body.time;
      if (body.amount !== undefined) db.records[idx].amount = body.amount;
      saveDb();
      return jsonResponse(res, 200, { success: true });
    }

    // 删除单条记录
    if (recMatch && req.method === 'DELETE') {
      db.records = db.records.filter(r => r.id !== recMatch[1]);
      saveDb();
      return jsonResponse(res, 200, { success: true });
    }

    // 清空用户记录
    const clearMatch = pathname.match(/^\/api\/records\/user\/(\d+)$/);
    if (clearMatch && req.method === 'DELETE') {
      const userId = parseInt(clearMatch[1]);
      db.records = db.records.filter(r => r.user_id !== userId);
      saveDb();
      return jsonResponse(res, 200, { success: true });
    }

    // 404
    jsonResponse(res, 404, { error: 'API 未找到' });

  } catch (e) {
    jsonResponse(res, 500, { error: e.message || '服务器错误' });
  }
}

// ========== 启动 ==========
loadDb();

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query || {};

  if (pathname.startsWith('/api')) {
    handleApi(req, res, pathname, query);
    return;
  }

  const filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  serveStaticFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 宝宝成长记录服务器已启动');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   数据文件: ${DATA_FILE}`);
  console.log(`   零依赖运行！无需 npm install`);
  console.log(`   更新接口: /api/update?token=${UPDATE_SECRET}`);
});
