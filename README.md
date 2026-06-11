# 🛡️ 银狐木马检测 — Virus Detector

> 一个 Chrome/Edge 浏览器扩展，实时检测银狐木马（Silver Fox Trojan）钓鱼/仿冒网站。

[![Manifest](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.2.0-orange)](https://github.com)

---

## ✨ 核心功能

通过 **5 条规则** 对访问的网站实时评分，分数 ≥ 100 时触发红色警告。

| 规则 | 最高加分 | 检测内容 |
| ---- | -------- | -------- |
| 🏷️ 域名仿冒 | **60 分** | 子串包含 / 段级关键词 / 可疑 TLD / 编辑距离识别仿冒域名 |
| 📦 压缩包下载 | **40 分** | 从可疑站点下载 `.zip` `.rar` `.7z` 等自动取消 + 加分 |
| 📋 ICP 备案缺失 | **50 分** | `.cn` 及中国品牌网站缺少备案号视为钓鱼 |
| 🔗 链接分析 | **60 分** | 同页链接过多 / 死链 / 外链绑定下载按钮 / 指向压缩包 |
| 🤖 AI 生成特征 | **30 分** | HTML 行数少 + 无框架痕迹 + 文本内容丰富 = AI 钓鱼页面 |

**总分 ≥ 100** → 🔴 图标变红 → 弹窗警告 → 注入下载拦截脚本 → 取消进行中的下载。

---

## 🎯 防御策略

### 域名仿冒检测（4 层匹配）

```text
策略1: 子串包含   → pc-huorong.com.cn 包含 huorong.com → 命中
策略2: 段级关键词 → deepseek-go.com 拆分 → "deepseek" 命中关键词
策略3: 可疑TLD    → huorong-download.xyz → .xyz 可疑 + 关键词
策略4: 编辑距离   → qq.om ≈ qq.com → 距离=1
```

### 下载拦截

一旦判定为危险网站，自动注入脚本到页面：

- 禁用所有带"下载 / Download"文本的按钮和链接
- 拦截指向 `.exe` `.zip` `.rar` `.msi` 等文件的点击
- 移除 `<a download>` 属性
- 页面顶部注入红色禁令横幅
- `MutationObserver` 持续监控动态加载的按钮

### 域名数据库

覆盖 **121 个** 中国常用软件/网站，19 个类别：

安全软件 · 浏览器 · 即时通讯 · 输入法 · 办公 · 视频 · 音乐 ·
云存储 · AI Chat · 下载工具 · 压缩工具 · 电商 · 地图出行 · 支付 ·
开发者工具 · 系统工具 · 游戏平台 · 游戏加速器 · 新闻资讯

---

## 🚀 快速开始

### Chrome 安装

1. 下载本项目或 `git clone`
2. 打开 `chrome://extensions/`
3. 开启 **开发者模式**（右上角开关）
4. 点击 **加载已解压的扩展程序**
5. 选择项目根目录

### Edge 安装

1. 打开 `edge://extensions/`
2. 开启 **开发人员模式**
3. 点击 **加载解压缩的扩展**
4. 选择项目根目录

---

## 📂 项目结构

```text
ViriusDetector/
├── manifest.json                   # MV3 扩展清单
├── icons/                          # 盾牌样式图标（绿/红）
├── background/
│   ├── service-worker.js           # 主协调器：导航/下载/消息/弹窗调度
│   ├── scoring-engine.js           # 5 规则评分引擎
│   ├── domain-database.js          # 121 条目域名数据库 + 仿冒检测
│   ├── cache-manager.js            # chrome.storage 缓存（24h TTL）
│   ├── similarity.js               # SimHash 文本相似度
│   └── icp-utils.js                # ICP 备案号正则（34 省份简称）
├── content/
│   └── content-script.js           # 页面分析：链接采集 · ICP 扫描 · 页面度量
├── popup/
│   ├── popup.html / .css / .js     # 工具栏弹窗：评分详情 + 安全建议
├── warning/
│   ├── warning.html / .css / .js   # 独立警告窗口：风险详情 + 官网链接
└── utils/
    ├── constants.js                # 评分常量 · 可疑 TLD · 下载关键词
    ├── url-utils.js                # 域名解析 · 嵌套 TLD 检测
    └── messaging.js                # 消息通信封装
```

---

## ⚙️ 评分体系

```text
规则一  域名仿冒        +60 ——→ 总分≥100?
规则二  压缩包下载      +40 ——→   │
规则三  ICP 备案缺失    +50 ——→   ├── YES → 🔴 红色图标 + 弹窗 + 拦截注入
规则四  链接分析        +60 ——→   │
规则五  AI 生成特征    +30 ——→   └── NO  → 🟢 绿色图标
                              (分数<100 且无 pageMetrics → 2秒后重试规则五)
```

### 缓存策略

检测结果缓存 24 小时，恶意 / 安全均缓存。Content Script 发回新数据时自动绕过缓存更新。

### 弹窗去重

同一标签页 5 秒冷却期，同域名不重复弹警告窗口。

---

## 🔧 所需权限

| 权限 | 用途 |
| ---- | ---- |
| `activeTab` | 读取当前标签页信息 |
| `storage` | 持久化评分状态与缓存 |
| `downloads` | 监听 + 取消下载 |
| `scripting` | 注入 Content Script 与拦截脚本 |
| `notifications` | 桌面风险通知 |
| `webNavigation` | 监听页面导航事件 |
| `<all_urls>` | 全网站覆盖 |

---

## 🛠️ 技术栈

- **纯原生 JavaScript**（ES Modules），零依赖，零构建
- Chrome Extension **Manifest V3**
- Service Worker 事件驱动架构
- Message Passing 通信（Background ↔ Content Script ↔ Popup）
- SimHash 64 位 + Levenshtein 编辑距离

---

## 📝 License

MIT
