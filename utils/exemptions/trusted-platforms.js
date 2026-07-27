/**
 * Virus Detector — 可信平台白名单 (Trusted Platforms)
 * ─────────────────────────────────────────────────────────────────────────
 * 豁免层级：**仅跳过规则一（域名仿冒检测）**，其他 7 条规则照常运行。
 *
 * 适用域名：
 *   - Wiki 农场、代码托管 Pages、PaaS / 静态托管、博客平台、文档 / 知识库、
 *     建站 / 个人页等 UGC 平台
 *
 * 设计目的：
 *   避免把合法的 fandom / github.io / notion 等 UGC 平台的子页面误判为仿冒官网。
 *   仅跳过仿冒检测，下载/链接/代码工程化等安全规则仍生效。
 *
 * 与同目录下其他文件的区别：
 *   - icp-exempt.js        → ICP_EXEMPT_DOMAINS            仅跳过规则三（ICP 备案）
 *   - 本文件                → TRUSTED_PLATFORMS             仅跳过规则一（域名仿冒）
 *   - fully-trusted.js      → FULLY_TRUSTED_DOMAIN_SUFFIXES  跳过全部 8 条规则
 *
 * 匹配粒度：eTLD+1（注册域），由 TrustedPlatforms 工具类进行 O(1) 查找。
 *
 * @module trusted-platforms
 */

// ==================== 可信平台域名集合 ====================
// Wiki / 代码托管 / 博客 / 文档 / 建站等 UGC 平台，规则一(仿冒官网)跳过。
export const TRUSTED_PLATFORMS = new Set([
  // ---- Wiki 平台 ----
  'fandom.com',
  'wikia.com',
  'wikimedia.org',
  'miraheze.org',
  'wiki.gg',
  'gamepedia.com',

  // ---- 代码托管 Pages ----
  'github.io',
  'gitlab.io',
  'bitbucket.io',
  'sourceforge.io',
  'codeberg.page',

  // ---- PaaS / 静态站点托管 ----
  'netlify.app',
  'vercel.app',
  'herokuapp.com',
  'pages.dev',          // Cloudflare Pages
  'surge.sh',
  'glitch.me',
  'onrender.com',
  'fly.dev',
  'workers.dev',        // Cloudflare Workers
  'deno.dev',

  // ---- 博客与内容平台 ----
  'medium.com',
  'wordpress.com',
  'blogger.com',
  'blogspot.com',
  'tumblr.com',
  'hatenablog.com',
  'fc2.com',
  'livejournal.com',
  'typepad.com',
  'substack.com',
  'ghost.io',
  'hashnode.dev',
  'dev.to',

  // ---- 文档与知识库 ----
  'readthedocs.io',
  'notion.site',
  'gitbook.io',

  // ---- 建站 / 个人页 ----
  'weebly.com',
  'wixsite.com',
  'jimdo.com',
  'strikingly.com',
  'carrd.co',
  'about.me',
  'linktr.ee',
]);
