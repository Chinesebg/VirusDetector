/**
 * Virus Detector — 统一豁免名单 (Unified Exemptions)
 * ─────────────────────────────────────────────────────────────────────────
 * 本文件为 barrel re-export，将所有豁免名单集中导出，保持向后兼容。
 *
 * 三种豁免层级（按信任程度递增）：
 *
 *   1. ICP_EXEMPT_DOMAINS（icp-exempt.js）
 *      外国 / 非中文站点，确定【不需要 ICP 备案】。
 *      → 仅跳过规则三（ICP 备案）。
 *      典型：google.com、github.com、wikipedia.org 等全球站点，
 *            以及 .edu / .gov / .ac.* / .gov.* 等教育/政府 TLD。
 *
 *   2. TRUSTED_PLATFORMS（trusted-platforms.js）
 *      Wiki / 代码托管 / 博客 / 文档 / 建站等 UGC 平台。
 *      → 仅跳过规则一（域名仿冒）。
 *      注意：其他安全规则（下载/链接/代码工程化等）仍生效。
 *
 *   3. FULLY_TRUSTED_DOMAIN_SUFFIXES（fully-trusted.js）
 *      由政府/教育主管部门严格管理的域名后缀，攻击者无法注册。
 *      → 完全跳过全部 8 条检测规则（等同于用户白名单）。
 *      包含：.gov.cn / .edu.cn / .gov.hk / .gov.tw / .ac.cn
 *
 * 说明：
 *   - 用户在「选项页」手动添加的域名白名单（chrome.storage.local）不在此处，
 *     运行时单独管理。
 *   - 非中国品牌的官方域名会在启动时由 domain-database 动态并入 ICP_EXEMPT_DOMAINS
 *     （见 icp-utils.registerNonChineseBrandDomains），无需在此手抄。
 */

export { ICP_EXEMPT_DOMAINS } from './icp-exempt.js';
export { TRUSTED_PLATFORMS } from './trusted-platforms.js';
export { FULLY_TRUSTED_DOMAIN_SUFFIXES, isFullyTrusted } from './fully-trusted.js';
