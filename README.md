# 👶 宝宝成长记录 — NAS 自部署版

> H5 宝宝记录应用，部署在你的 NAS 上，数据永远不丢、永不冻结、不依赖外网。

## ✨ 功能

- 💩 大便 / 💧 小便 / 🍼 瓶喂 / 🤱 亲喂 / 😴 睡眠 / ⚖️ 体重 六类记录
- 📊 今日统计：大便、小便、喂奶次数、奶量ml、睡眠小时
- 📈 趋势图：喝奶量、最大单次、体重、睡眠
- 👶 多宝宝支持（名字+出生日期+性别）
- 📤 数据导出/导入
- 🔄 自动更新（push → 容器自更新）

## 🏗️ 项目结构

```
baby-log/
├── server.js          ← API 服务（纯 Node.js 内置模块，零依赖）
├── README.md          ← 就是这个文件
└── public/
    └── index.html     ← 前端页面（单页 H5）
```

只有 **2 个文件** + 这个 README，无 node_modules、无 Dockerfile、无构建工具。

## 🚀 首次部署（极空间 Docker）

### 1. 准备代码

从 GitHub 下载或手动创建代码文件夹，扔到 NAS 共享目录：

```
/你的NAS共享路径/baby-log/
├── server.js
└── public/
    └── index.html
```

### 2. 拉取镜像

极空间 Docker → **镜像仓库** → 搜索 `node:20-alpine` → 拉取

### 3. 创建容器

| 设置 | 值 |
|------|-----|
| 镜像 | `node:20-alpine` |
| 容器名称 | `baby-log` |
| 命令 | `node /app/server.js` |
| 重启策略 | 容器退出时总是重启 |

**存储挂载（2 个）：**

| 容器路径 | NAS 路径 | 说明 |
|---------|---------|------|
| `/app` | 你的代码文件夹路径 | 放 server.js 和 public/ |
| `/data` | 你的数据目录路径（如 `/docker/baby-log-data/`） | JSON 数据库文件，落 NAS 硬盘 |

**端口映射：** 容器 `3000` → NAS `3000`（或你喜欢的端口）

**环境变量：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `UPDATE_TOKEN` | `baby-log-update` | 更新接口密码，部署时建议改掉 |

> ⚠️ **第一次部署后，首次更新需要手动操作一次：** 替换挂载文件夹里的 `server.js`，然后在 Docker 界面点「重启容器」。之后所有更新全部自动。

## 🔄 更新流程（push 之后怎么办）

代码改好 push 到 GitHub 后，需要在 NAS 上触发容器自更新。

### 方式一：浏览器直接触发

访问（替换成你的 NAS 地址）：

```
http://你的NAS_IP:3000/api/update?token=你的更新密码
```

页面返回 `{"success":true,"message":"✅ 更新成功，正在重启..."}` 后，等 5-10 秒刷新页面即可。

### 方式二：从命令行触发

```bash
curl "http://你的NAS_IP:3000/api/update?token=你的更新密码"
```

### 方式三：从 Hermes Agent 自动执行（推荐）

在 Hermes Agent 中一键完成：

```python
import time, urllib.request, json, base64, subprocess, shutil, os

WORK = "/tmp/baby-log-nas-zero"
CONTAINER_IP = "172.23.0.1"   # baby-log 容器的内网 IP
TOKEN = "baby-log-update"
GH_REPO = "https://github.com/gaoyingxie/baby-log.git"
BRANCH = "nas-server"

# 1. 推送代码到 GitHub
subprocess.run(["git", "add", "-A"], cwd=WORK, capture_output=True)
subprocess.run(["git", "commit", "-m", "自动更新"], cwd=WORK, capture_output=True)
subprocess.run(["git", "push", "origin", f"master:{BRANCH}"], cwd=WORK, capture_output=True, timeout=30)

# 2. 触发容器自更新（容器从 GitHub 下载最新代码 → 解压 → 重启）
res = urllib.request.urlopen(f"http://{CONTAINER_IP}:3000/api/update?token={TOKEN}", timeout=30)
data = json.loads(res.read())
assert data.get("success"), f"更新失败: {data}"

# 3. 等待重启完毕，验证版本
for i in range(15):
    try:
        res = urllib.request.urlopen(f"http://{CONTAINER_IP}:3000/", timeout=3)
        html = res.read().decode()
        print(f"✅ 第{i+1}秒验证通过")
        break
    except Exception:
        time.sleep(2)
```

### 更新原理

```
你 push 到 GitHub
      ↓
请求 GET /api/update?token=xxx
      ↓
容器自己下载 GitHub 最新 tar.gz
      ↓
解压 → 替换 /app/server.js + /app/public/
      ↓
process.exit(0) → Docker 重启策略自动拉起新进程
      ↓
新代码生效 ✨
```

## 🛠️ 版本号

版本号写在 `public/index.html` 底部：

```html
<div class="version">v4.5 · 😴 睡眠统计 🎉</div>
```

每次发布新版本记得改版本号，方便确认部署是否成功。

## 💾 数据

数据库文件在 `/data/data.json`（NAS 硬盘上），你可以直接打开看：

```json
{
  "users": [...],
  "records": [...],
  "nextId": 123
}
```

**数据安全：**
- 文件落 NAS 硬盘，永不丢失
- 不存在第三方服务器，不会被墙、不会被冻结
- 支持导出/导入（应用内菜单操作）
- 手动备份：直接复制 `data.json` 到别处

## 🐳 Docker 内网信息

| 容器 | IP | 端口 |
|------|----|------|
| baby-log | 172.23.0.1 | 3000 |
| hermes-agent | 172.23.0.3 | — |

同属 `172.23.0.0/16` Docker 内网，容器间可直接通信。

## 🔧 常见问题

**Q: 页面打开是旧版本？**
A: 浏览器缓存，Ctrl+F5 刷新即可。

**Q: 更新后页面白屏？**
A: 等 5-10 秒容器重启完成，刷新页面。

**Q: 更新接口返回 403？**
A: `UPDATE_TOKEN` 不对，检查容器环境变量设置。

**Q: 容器里装不了 npm 包？**
A: `node:20-alpine` 镜像的 npm 有"Tracker idealTree" bug（alpine 版特有的 npm 打包问题），所有包无法安装。需要用零依赖方案（只用 Node.js 内置模块），或换 `node:20`（Debian 版）。
