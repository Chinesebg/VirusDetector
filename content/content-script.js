/**
 * 银狐木马检测 - Content Script
 *
 * 职责：
 * 1. 采集页面度量（规则五：AI生成特征检测）
 * 2. 扫描ICP备案号
 * 3. 采集链接分析数据（规则四：同页链接/死链/外链文件）
 * 4. 下载拦截注入（由Service Worker触发）
 */

(function () {
  'use strict';

  // ==================== 规则四：链接分析数据采集 ====================

  function collectLinkMetrics() {
    var currentUrl = window.location.href;
    var currentOrigin = window.location.origin;
    var currentPath = window.location.pathname;
    var currentHost = window.location.hostname;

    var links = document.querySelectorAll('a[href]');
    var samePageLinks = 0;
    var deadLinks = 0;
    var deadLinkSamples = [];
    var externalDownloadLinks = [];

    var DEAD = [/^#?$/, /^javascript\s*:/i, /^#\d*$/];
    var DOWNLOAD_KW = ['下载','download','下載','立即下载','免费下载','高速下载',
      '安全下载','点击下载','直接下载','本地下载','官方下载','download now',
      'free download','立即安装','一键安装','安装包','setup','install','get started'];
    var FILE_EXTS = ['.exe','.msi','.dmg','.apk','.zip','.rar','.7z',
      '.tar','.gz','.tgz','.bz2','.xz','.iso','.cab','.arj','.bat','.cmd',
      '.ps1','.vbs','.scr','.jar','.bin','.run','.sh','.pkg'];
    var ARCHIVE_EXTS = ['.zip','.rar','.7z','.tar','.gz','.tgz','.bz2','.xz',
      '.iso','.cab','.arj','.lzh','.z','.zst'];

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = (link.getAttribute('href') || '').trim();
      if (!href) continue;
      var lowerHref = href.toLowerCase();

      // ① 同页链接
      try {
        var resolved = new URL(href, window.location.href);
        if (resolved.origin === currentOrigin && resolved.pathname === currentPath) {
          samePageLinks++;
        }
      } catch (e) {
        if (href === window.location.pathname || href === window.location.pathname + window.location.search ||
            (href.startsWith('?') && href.length > 1) || (href.startsWith('#') && href.length > 1 && !/^#\d*$/.test(href))) {
          samePageLinks++;
        }
      }

      // ② 死链
      if (DEAD.some(function(p) { return p.test(href); })) {
        deadLinks++;
        if (deadLinkSamples.length < 5) {
          deadLinkSamples.push({ href: href.substring(0, 100), text: (link.textContent || '').trim().substring(0, 50) });
        }
      }

      // 外链分析
      try {
        var resolved2 = new URL(href, window.location.href);
        if (resolved2.hostname && resolved2.hostname !== currentHost) {
          var linkText = (link.textContent || '').toLowerCase();
          var parentText = (link.parentElement ? link.parentElement.textContent : '').toLowerCase();
          var ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
          var className = (link.className || '').toLowerCase();
          var parentClass = (link.parentElement ? link.parentElement.className : '').toLowerCase();
          var combined = [linkText, parentText, ariaLabel, className, parentClass].join(' ');

          var hasDownloadText = DOWNLOAD_KW.some(function(kw) { return combined.includes(kw); });
          var isFileLink = FILE_EXTS.some(function(ext) { return lowerHref.endsWith(ext); });
          var isArchive = ARCHIVE_EXTS.some(function(ext) { return lowerHref.endsWith(ext); });

          if (hasDownloadText || isFileLink) {
            externalDownloadLinks.push({
              href: href.substring(0, 200),
              text: (link.textContent || '').trim().substring(0, 80),
              hasDownloadText: hasDownloadText, isFileLink: isFileLink, isArchive: isArchive
            });
          }
        }
      } catch (e) {}
    }

    // 去重
    var seen = new Set();
    var unique = externalDownloadLinks.filter(function(d) {
      if (seen.has(d.href)) return false; seen.add(d.href); return true;
    });

    return {
      totalLinks: links.length,
      samePageLinks: samePageLinks, deadLinks: deadLinks, deadLinkSamples: deadLinkSamples,
      externalDownloadLinks: unique,
      externalWithDownloadText: unique.filter(function(d) { return d.hasDownloadText; }).length,
      externalFileLinks: unique.filter(function(d) { return d.isFileLink; }).length,
      externalArchiveLinks: unique.filter(function(d) { return d.isArchive; }).length
    };
  }

  // ==================== 规则五：页面度量采集 ====================

  function collectPageMetrics() {
    const html = document.documentElement.outerHTML || '';
    const htmlLines = html.split('\n').length;

    // 外部脚本计数
    const scripts = document.querySelectorAll('script[src]');
    const externalScripts = scripts.length;
    const scriptSrcs = Array.from(scripts).map(s => s.getAttribute('src') || '');

    // 框架标记检测
    const htmlLower = html.substring(0, 5000).toLowerCase(); // 前5000字符足够
    const frameworkMarkers = [
      'react', 'vue', 'angular', 'webpack', '__initial_state__',
      '_next/', 'nuxt', 'svelte', 'jquery', 'bootstrap',
      'node_modules', '.jsx', '.tsx'
    ];
    const hasFrameworkMarkers = frameworkMarkers.some(m => htmlLower.includes(m));

    // 页面文本长度
    const bodyText = (document.body ? document.body.innerText : '') || '';
    const textLength = bodyText.length;

    // Meta generator（AI生成页面的典型特征）
    const metaGenerator = document.querySelector('meta[name="generator"]');
    const generator = metaGenerator ? metaGenerator.getAttribute('content') : null;

    // 内联样式数量（AI生成页面通常有大量内联样式）
    const inlineStyles = document.querySelectorAll('[style]').length;

    // <head>中的<link>数量
    const headLinks = document.querySelectorAll('head link').length;

    return {
      htmlLines,
      externalScripts,
      scriptSrcs,
      hasFrameworkMarkers,
      textLength,
      generator,
      inlineStyles,
      headLinks,
      url: window.location.href
    };
  }

  // ==================== ICP备案号扫描 ====================

  function findIcpStrings() {
    const icpStrings = [];
    const seen = new Set();

    function add(text) {
      const t = text.trim();
      if (t.length > 3 && t.length < 500 && !seen.has(t) &&
          /ICP|icp|备案|beian|BeiAn|BEIAN|备/.test(t)) {
        icpStrings.push(t); seen.add(t);
      }
    }

    // footer
    document.querySelectorAll('footer, .footer, #footer, [class*="footer"], [id*="footer"]')
      .forEach(el => add(el.textContent || ''));

    // icp/beian元素
    const sel = '[id*="icp"],[class*="icp"],[id*="beian"],[class*="beian"],' +
                '[id*="备案"],[class*="备案"],[id*="copyright"],[class*="copyright"],' +
                '.record,#record,.icp-info,#icp-info,.beian-info,#beian-info';
    try {
      document.querySelectorAll(sel).forEach(el => add(el.textContent || ''));
    } catch (e) { /* selector error */ }

    // 页面底部元素
    const children = document.body ? [...document.body.children] : [];
    for (let i = Math.max(0, children.length - 5); i < children.length; i++) {
      const t = (children[i].textContent || '').trim();
      if (t.length > 10 && t.length < 1000) add(t);
    }

    // TreeWalker（限制范围）
    let count = 0;
    try {
      const walker = document.createTreeWalker(
        document.body || document.documentElement, NodeFilter.SHOW_TEXT,
        { acceptNode: () => (count++ < 3000) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
      );
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t.length > 5 && t.length < 300 &&
            (t.includes('ICP') || t.includes('备') || t.includes('icp') || t.includes('beian'))) {
          add(t);
        }
      }
    } catch (e) { /* ignore */ }

    return icpStrings;
  }

  // ==================== 发送分析结果 ====================

  function safeCollect(fn, fallback) {
    try { return fn(); } catch (e) { console.error('[VirusDetector] 采集失败:', e); return fallback; }
  }

  function sendAnalysisResult() {
    // 每个采集函数独立 try-catch，一个失败不影响其他
    var pageMetrics = safeCollect(collectPageMetrics, null);
    var icpStrings = safeCollect(findIcpStrings, []);
    var linkMetrics = safeCollect(collectLinkMetrics, null);

    chrome.runtime.sendMessage({
      type: 'PAGE_ANALYSIS_RESULT',
      payload: {
        url: window.location.href, domain: window.location.hostname, title: document.title,
        pageText: safeCollect(function() { return (document.body ? document.body.innerText : '').substring(0, 3000); }, ''),
        icpStrings: icpStrings, pageMetrics: pageMetrics, linkMetrics: linkMetrics
      },
      timestamp: Date.now()
    }).catch(function() {});
  }

  // ==================== 消息监听 ====================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'REQUEST_PAGE_TEXT') {
      try {
        sendResponse({
          success: true,
          pageMetrics: collectPageMetrics(),
          linkMetrics: collectLinkMetrics(),
          icpStrings: findIcpStrings(),
          pageText: (document.body ? document.body.innerText : '').substring(0, 3000),
          title: document.title,
          url: window.location.href
        });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
    return false;
  });

  // ==================== 初始化 ====================

  function init() {
    setTimeout(sendAnalysisResult, 600);
    // 二次扫描（懒加载页脚）
    setTimeout(sendAnalysisResult, 3500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('load', () => setTimeout(sendAnalysisResult, 600));
  }

})();
