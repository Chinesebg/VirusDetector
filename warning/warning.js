/**
 * 警告窗口控制器
 * 从URL参数读取检测结果并渲染警告界面
 */
(function () {
  'use strict';

  // 从URL参数读取数据
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain') || '未知网站';
  const score = parseInt(params.get('score')) || 0;
  const correctUrl = params.get('correctUrl') || '';
  const officialName = params.get('officialName') || '';

  // DOM
  document.getElementById('risk-score').textContent = score;
  document.getElementById('info-domain').textContent = domain;
  document.getElementById('info-time').textContent = new Date().toLocaleString('zh-CN');

  // 官方网站
  if (correctUrl) {
    document.getElementById('official-section').style.display = 'block';
    document.getElementById('official-domain').textContent = correctUrl;
    const btn = document.getElementById('official-btn');
    btn.href = correctUrl;
  }

  // 按钮事件
  document.getElementById('btn-close').addEventListener('click', () => {
    // 关闭当前窗口，并尝试关闭可疑标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // 找到包含该域名的标签页并关闭
      chrome.tabs.query({ url: '*://*' + domain.replace(/^www\./i, '') + '/*' }, (matched) => {
        if (matched.length > 0) {
          chrome.tabs.remove(matched.map(t => t.id));
        }
      });
    });
    window.close();
  });

  document.getElementById('btn-back-safe').addEventListener('click', () => {
    if (correctUrl) {
      chrome.tabs.create({ url: correctUrl });
    } else {
      chrome.tabs.create({ url: 'https://www.baidu.com' });
    }
    window.close();
  });
})();
