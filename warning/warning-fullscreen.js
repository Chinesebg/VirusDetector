/**
 * 银狐木马检测 - 全屏覆盖拦截页控制器
 *
 * 职责：
 * - 从 URL 参数读取检测结果并渲染全屏拦截界面（页面整体替换标签页）
 * - 处理回退、前往官网、加入白名单继续访问与误报上报
 *
 * 前置条件：
 * - 由 Service Worker 构造 URL 参数打开本页：mode、domain、score、correctUrl、officialName、originalUrl
 *   （correctUrl/originalUrl 经 sanitizeUrl 协议白名单校验，仅允许 http/https，防 javascript: 注入）
 *
 * 输入与输出：
 * - 输入：URL 参数 + 用户操作（回退/前往官网/信任并继续/误报上报）
 * - 副作用：信任操作经 ADD_TO_WHITELIST 回传 SW 加入白名单并跳回原网页；
 *   误报经 SUBMIT_REPORT 回传并延时自关（PHISH_CONFIRM_TIMEOUT_MS）
 */
import {
  MSG_TYPES, REPORT_TYPES, PHISH_CONFIRM_TIMEOUT_MS
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

  document.getElementById('info-domain').textContent = domain;
  document.getElementById('dialog-domain').textContent = domain;

  const pageStatusEl = document.getElementById('page-status');
  const dialogStatusEl = document.getElementById('dialog-status');

  function setPageStatus(message) { pageStatusEl.textContent = message || ''; }
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

  /** 回退：回到被拦截前的原网页（同标签页历史仍在），无历史时关闭标签页 */
  function returnToSafety() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      closeSelf();
    }
  }

  /** 前往官网：关闭危险标签页并在旁边打开官网，随后关闭拦截页 */
  async function goOfficial() {
    await closeDangerousTabs(domain);
    if (correctUrl) {
      await openSafePage(correctUrl);
    }
    closeSelf();
  }

  // ---- 主按钮 ----

  document.getElementById('btn-back').addEventListener('click', returnToSafety);

  const secondBtn = document.getElementById('btn-second');
  if (correctUrl) {
    secondBtn.textContent = '前往官网';
    secondBtn.addEventListener('click', goOfficial);
  } else {
    secondBtn.addEventListener('click', closeSelf);
  }

  // ---- 信任并继续访问 ----

  const trustDialog = document.getElementById('trust-dialog');

  document.getElementById('btn-review-trust').addEventListener('click', () => {
    setDialogStatus('');
    trustDialog.showModal();
  });

  document.getElementById('btn-cancel-trust').addEventListener('click', () => {
    trustDialog.close();
    returnToSafety();
  });

  trustDialog.addEventListener('cancel', event => {
    event.preventDefault();
    trustDialog.close();
    returnToSafety();
  });

  document.getElementById('btn-confirm-trust').addEventListener('click', async () => {
    const confirmBtn = document.getElementById('btn-confirm-trust');
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
      // 白名单已生效：直接回到原网页继续访问
      window.location.replace(originalUrl);
    } catch (error) {
      confirmBtn.disabled = false;
      setDialogStatus('保存失败，请重试或返回安全页面');
    }
  });

  // ---- 误报上报 ----

  const reportFalseBtn = document.getElementById('btn-report-false');
  reportFalseBtn.addEventListener('click', async () => {
    reportFalseBtn.disabled = true;
    reportFalseBtn.textContent = '上报中...';
    try {
      await chrome.runtime.sendMessage({
        type: MSG_TYPES.SUBMIT_REPORT,
        payload: { reportType: REPORT_TYPES.FALSE_POSITIVE, domain, note: '' }
      });
      reportFalseBtn.textContent = '已上报为误报，感谢反馈';
      setPageStatus('感谢反馈，即将关闭此页面');
      setTimeout(() => closeSelf(), PHISH_CONFIRM_TIMEOUT_MS);
    } catch (e) {
      console.error('[Warning] 误报上报失败:', e);
      reportFalseBtn.textContent = '上报失败，请重试';
      reportFalseBtn.disabled = false;
    }
  });
})();
