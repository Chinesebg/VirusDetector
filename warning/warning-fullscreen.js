/**
 * 银狐木马检测 - 全屏覆盖拦截页控制器
 *
 * 职责：
 * - 从 URL 参数读取检测结果并渲染全屏拦截界面（页面整体替换标签页）
 * - 「前往官网」：有官网时打开官网；无官网时用提取的关键词打开百度搜索兜底
 * - 「我了解风险，仍要访问」：二次确认是否加入白名单，无论是否加入都放行访问
 *
 * 前置条件：
 * - 由 Service Worker 构造 URL 参数打开本页：mode、domain、score、correctUrl、
 *   officialName、originalUrl、keywords
 *   （correctUrl/originalUrl 经 sanitizeUrl 协议白名单校验，仅允许 http/https）
 *
 * 输入与输出：
 * - 输入：URL 参数 + 用户操作（前往官网/关闭/加入白名单/仅本次访问）
 * - 副作用：ADD_TO_WHITELIST 加入白名单；ALLOW_ACCESS_ONCE 单次放行
 */
import {
  MSG_TYPES, BAIDU_SEARCH_URL
} from '../utils/constants.js';

(function () {
  'use strict';

  /**
   * 验证 URL 协议，仅允许 http/https，防止 javascript: 等注入
   * 双重校验：URL 解析器协议白名单 + 显式 scheme 正则（防畸形输入与编码绕过）
   * @param {string} url
   * @returns {string} 安全 URL，无效时返回空字符串
   */
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return '';
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    } catch (e) { /* fall through */ }
    return trimmed;
  }

  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain') || '未知网站';
  const score = Math.max(0, parseInt(params.get('score'), 10) || 0);
  const correctUrl = sanitizeUrl(params.get('correctUrl') || '');
  const originalUrl = sanitizeUrl(params.get('originalUrl') || '') || sanitizeUrl('https://' + domain);
  const keywords = (params.get('keywords') || '').trim();

  document.getElementById('info-domain').textContent = domain;
  document.getElementById('dialog-domain').textContent = domain;

  const dialogStatusEl = document.getElementById('dialog-status');

  function setDialogStatus(message) { dialogStatusEl.textContent = message || ''; }

  /** 关闭当前拦截标签页（移除标签页；异常时回退 window.close()） */
  async function closeSelf() {
    try {
      const current = await chrome.tabs.getCurrent();
      if (current && current.id !== undefined) {
        await chrome.tabs.remove(current.id);
        return;
      }
    } catch (e) { /* 非标签页上下文，回退 window.close() */ }
    window.close();
  }

  /**
   * 关闭匹配危险域名的所有标签页
   * @param {string} targetDomain - 需要关闭的域名
   * @returns {Promise<number>} 关闭的标签页数量
   */
  async function closeDangerousTabs(targetDomain) {
    try {
      const cleanDomain = targetDomain.replace(/^www\./i, '');
      const allTabs = await chrome.tabs.query({});
      const targets = allTabs.filter(tab => {
        try {
          const host = new URL(tab.url || '').hostname.replace(/^www\./i, '');
          return host === cleanDomain || host.endsWith('.' + cleanDomain);
        } catch (e) { return false; }
      });

      if (targets.length > 0) {
        await chrome.tabs.remove(targets.map(t => t.id));
      }
      return targets.length;
    } catch (e) {
      console.error('[Warning] 关闭危险标签页失败:', e);
      return 0;
    }
  }

  /**
   * 打开安全页面
   * @param {string} url - 目标 URL
   */
  async function openSafePage(url) {
    try {
      const existingTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (existingTabs.length > 0) {
        await chrome.tabs.create({ url, index: existingTabs[0].index + 1 });
      } else {
        await chrome.tabs.create({ url });
      }
    } catch (e) {
      console.error('[Warning] 打开安全页面失败:', e);
    }
  }

  /** 前往官网：关闭危险标签页并打开官网，随后关闭拦截页 */
  async function goOfficial() {
    await closeDangerousTabs(domain);
    if (correctUrl) {
      await openSafePage(correctUrl);
    }
    closeSelf();
  }

  /** 无官网时的兜底：用提取的关键词打开百度搜索 */
  async function openSearch() {
    const query = keywords || domain;
    try {
      await chrome.tabs.create({ url: BAIDU_SEARCH_URL + encodeURIComponent(query) });
    } catch (e) {
      console.error('[Warning] 打开搜索失败:', e);
    }
    closeSelf();
  }

  /** 放行访问原网页（导航由按钮的二次确认流程触发） */
  function visitOriginal() {
    window.location.replace(originalUrl);
  }

  // ---- 主按钮 ----

  document.getElementById('btn-official').addEventListener('click', () => {
    if (correctUrl) {
      goOfficial();
    } else {
      openSearch();
    }
  });

  document.getElementById('btn-close-page').addEventListener('click', closeSelf);

  // ---- 信任并继续访问 ----

  const trustDialog = document.getElementById('trust-dialog');

  document.getElementById('btn-review-trust').addEventListener('click', () => {
    setDialogStatus('');
    trustDialog.showModal();
  });

  trustDialog.addEventListener('cancel', event => {
    event.preventDefault();
    trustDialog.close();
  });

  // 是，加入白名单：白名单 + 放行访问
  document.getElementById('btn-confirm-whitelist').addEventListener('click', async () => {
    const confirmBtn = document.getElementById('btn-confirm-whitelist');
    confirmBtn.disabled = true;
    setDialogStatus('正在保存信任设置');
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG_TYPES.ADD_TO_WHITELIST,
        payload: { url: originalUrl }
      });
      if (!response || response.success !== true) {
        throw new Error(response && response.error ? response.error : 'unknown_error');
      }
      visitOriginal();
    } catch (error) {
      console.error('[Warning] 加入白名单失败:', error);
      confirmBtn.disabled = false;
      setDialogStatus('保存失败，请重试（' + (error && error.message ? error.message : '未知错误') + '）');
    }
  });


  // 不，仅本次访问：单次放行（不加入白名单）+ 放行访问
  document.getElementById('btn-visit-once').addEventListener('click', async () => {
    const visitBtn = document.getElementById('btn-visit-once');
    visitBtn.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG_TYPES.ALLOW_ACCESS_ONCE,
        payload: { url: originalUrl }
      });
      if (!response || response.success !== true) {
        throw new Error(response && response.error ? response.error : 'unknown_error');
      }
      visitOriginal();
    } catch (error) {
      console.error('[Warning] 单次放行失败:', error);
      visitBtn.disabled = false;
      setDialogStatus('操作失败，请重试（' + (error && error.message ? error.message : '未知错误') + '）');
    }
  });
})();

// ==================== 底部链接与报告对话框（新增，独立块，不影响既有逻辑） ====================

(async function () {
  'use strict';

  // 动态导入新增模块符号，避免改动顶部既有 import 语句
  const { REPORT_TYPES, PHISH_CONFIRM_TIMEOUT_MS } = await import('../utils/constants.js');

  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain') || '未知网站';

  const reportDialog = document.getElementById('report-dialog');
  const reportStatusEl = document.getElementById('report-status');

  function setReportStatus(message) {
    if (reportStatusEl) reportStatusEl.textContent = message || '';
  }

  // 打开报告对话框
  document.getElementById('btn-report-link').addEventListener('click', () => {
    setReportStatus('');
    reportDialog.showModal();
  });

  // 右上角叉叉 / Esc 关闭
  document.getElementById('btn-report-close').addEventListener('click', () => reportDialog.close());
  reportDialog.addEventListener('cancel', event => {
    event.preventDefault();
    reportDialog.close();
  });

  /**
   * 提交指定类型的报告（与 popup 页面的误报/钓鱼按钮同款功能：SUBMIT_REPORT）
   * @param {HTMLButtonElement} button 触发按钮
   * @param {string} reportType REPORT_TYPES 枚举值
   */
  async function submitReport(button, reportType) {
    button.disabled = true;
    setReportStatus('上报中...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG_TYPES.SUBMIT_REPORT,
        payload: { reportType, domain, note: '' }
      });
      if (response && response.success === false) {
        throw new Error(response.error || 'submit_failed');
      }
      setReportStatus('已上报，感谢反馈');
      setTimeout(() => reportDialog.close(), PHISH_CONFIRM_TIMEOUT_MS);
    } catch (e) {
      console.error('[Warning] 报告提交失败:', e);
      button.disabled = false;
      setReportStatus('上报失败，请重试');
    }
  }

  document.getElementById('btn-report-false').addEventListener('click', (e) => {
    submitReport(e.currentTarget, REPORT_TYPES.FALSE_POSITIVE);
  });
  document.getElementById('btn-report-phish').addEventListener('click', (e) => {
    submitReport(e.currentTarget, REPORT_TYPES.CONFIRMED_PHISH);
  });
})();
