/**
 * 银狐木马检测 - Popup UI (v1.1)
 * 适配新5规则评分体系
 */
(function () {
  'use strict';

  const SCORE_THRESHOLD = 100;

  const $ = (id) => document.getElementById(id);

  const els = {
    header: $('header'), loading: $('loading'),
    safePanel: $('safe-panel'), warningPanel: $('warning-panel'),
    scoreValue: $('score-value'), statusText: $('status-text'),
    currentDomain: $('current-domain'),
    warningScoreValue: $('warning-score-value'),
    warningStatusText: $('warning-status-text'),
    officialLinkSection: $('official-link-section'),
    officialLinkBtn: $('official-link-btn'),
    officialLinkText: $('official-link-text'),
    safetyTips: $('safety-tips'),
    refreshBtn: $('refresh-btn'),
    detailRules: {
      rule1: $('detail-rule1'), rule2: $('detail-rule2'),
      rule3: $('detail-rule3'), rule4: $('detail-rule4'),
      rule5: $('detail-rule5')
    }
  };

  function showLoading() {
    els.loading.style.display = 'block';
    els.safePanel.style.display = 'none';
    els.warningPanel.style.display = 'none';
    els.safetyTips.style.display = 'none';
    els.officialLinkSection.style.display = 'none';
    els.header.className = 'header-safe';
  }

  function showSafe(data) {
    els.loading.style.display = 'none';
    els.safePanel.style.display = 'block';
    els.warningPanel.style.display = 'none';
    els.safetyTips.style.display = 'none';
    els.officialLinkSection.style.display = 'none';
    els.header.className = 'header-safe';
    els.scoreValue.textContent = data.score || 0;
    els.statusText.textContent = '安全';
    els.currentDomain.textContent = data.domain || '-';
  }

  function showWarning(data) {
    els.loading.style.display = 'none';
    els.safePanel.style.display = 'none';
    els.warningPanel.style.display = 'block';
    els.safetyTips.style.display = 'block';
    els.header.className = 'header-danger';
    els.warningScoreValue.textContent = data.score || 0;
    els.warningStatusText.textContent = '⚠️ 危险警告';

    if (data.correctUrl) {
      els.officialLinkSection.style.display = 'block';
      els.officialLinkBtn.href = data.correctUrl;
      els.officialLinkText.textContent = data.correctUrl;
    } else {
      els.officialLinkSection.style.display = 'none';
    }
  }

  function updateDetails(ruleResults) {
    if (!ruleResults) return;
    for (const key of Object.keys(els.detailRules)) {
      const rule = ruleResults[key];
      const el = els.detailRules[key];
      if (!el) continue;
      const iconEl = el.querySelector('.detail-icon');
      const textEl = el.querySelector('.detail-text');
      if (rule && rule.detailCN) {
        if (rule.triggered) {
          iconEl.textContent = '✗'; iconEl.style.color = '#F44336';
          textEl.style.color = '#F44336';
        } else if (rule.detailCN.startsWith('✓')) {
          iconEl.textContent = '✓'; iconEl.style.color = '#4CAF50';
          textEl.style.color = '#4CAF50';
        } else {
          iconEl.textContent = '-'; iconEl.style.color = '#a0a0a0';
          textEl.style.color = '#a0a0a0';
        }
        textEl.textContent = rule.detailCN;
      }
    }
  }

  function showError(msg) {
    els.loading.innerHTML = `<div style="text-align:center;padding:20px;">
      <p style="color:#F44336;">⚠️ ${msg || '无法获取检测结果'}</p>
      <p style="font-size:12px;color:#a0a0a0;margin-top:8px;">请确保已打开网页，点击"重新检测"重试</p></div>`;
    els.loading.style.display = 'block';
    els.safePanel.style.display = 'none';
    els.warningPanel.style.display = 'none';
    els.safetyTips.style.display = 'none';
  }

  async function fetchState() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_TAB_STATE', payload: {} });
      return (resp && resp.success) ? resp.data : null;
    } catch (e) { return null; }
  }

  async function requestReanalysis() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_PAGE_TEXT', payload: {} });
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) { /* content script may not be ready */ }
  }

  async function render() {
    showLoading();
    let data = await fetchState();
    if (!data || !data.isAnalyzed) {
      await requestReanalysis();
      data = await fetchState();
    }
    if (!data) { showError('无法获取页面分析结果'); return; }

    if (data.score >= SCORE_THRESHOLD) { showWarning(data); }
    else { showSafe(data); }
    updateDetails(data.ruleResults);
  }

  els.refreshBtn.addEventListener('click', async () => {
    showLoading();
    els.refreshBtn.textContent = '⏳ 检测中...';
    els.refreshBtn.disabled = true;
    await requestReanalysis();
    await render();
    els.refreshBtn.textContent = '🔄 重新检测';
    els.refreshBtn.disabled = false;
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    render();
  } else {
    document.addEventListener('DOMContentLoaded', render);
  }
})();
