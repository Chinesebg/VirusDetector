/**
 * 提取用于「前往官网」兜底搜索的页面关键词（v1 最简实现）。
 *
 * 结构约定：本模块是关键词提取的唯一入口，后续迭代（分词/停用词、
 * 与检测规则联动、多信号融合等）只改本文件，调用方不感知。
 *
 * 当前策略：
 *   - 域名去掉 www. 前缀作为主关键词；
 *   - 页面标题按常见分隔符切词，过滤单字，取前 4 个；
 *   - 去重后整体截断至 40 字符，保证搜索 URL 长度合理。
 *
 * @param {Object} tabState 危险标签页状态
 * @returns {string} 空格分隔的关键词（URL 编码由调用方处理）
 */
export function extractSearchKeywords(tabState) {
  const parts = [];
  const domain = String(tabState?.domain || '');
  if (domain) parts.push(domain.replace(/^www\./i, ''));

  const title = String(tabState?.title || '');
  const words = title
    .split(/[\s|｜\-—:：,，.。!！?？()（）【】\[\]{}<>《》"'“”‘’/\\+&]+/)
    .filter(w => w.length >= 2)
    .slice(0, 4);

  return [...new Set([...parts, ...words])].join(' ').slice(0, 40);
}
