/**
 * 缓存管理器
 * 使用 chrome.storage.local 缓存检测结果，有效期24小时
 *
 * 缓存条目结构：
 * {
 *   domain: string,
 *   score: number,
 *   isMalicious: boolean,
 *   correctUrl: string | null,
 *   ruleResults: object,
 *   timestamp: number
 * }
 */

import { STORAGE_KEYS, CACHE_TTL } from '../utils/constants.js';

export class CacheManager {
  /**
   * 获取域名的缓存结果
   * @param {string} domain
   * @returns {Object|null} 缓存结果，过期或不存在返回null
   */
  static async get(domain) {
    try {
      const key = STORAGE_KEYS.DOMAIN_CACHE + domain;
      const result = await chrome.storage.local.get(key);
      const entry = result[key];

      if (!entry) return null;

      // 检查是否过期
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        // 过期删除
        await chrome.storage.local.remove(key);
        return null;
      }

      return entry;
    } catch (e) {
      console.error('[CacheManager] 读取缓存失败:', e);
      return null;
    }
  }

  /**
   * 设置域名缓存
   * @param {string} domain
   * @param {Object} data - { score, isMalicious, correctUrl, ruleResults }
   */
  static async set(domain, data) {
    try {
      const key = STORAGE_KEYS.DOMAIN_CACHE + domain;
      await chrome.storage.local.set({
        [key]: {
          domain,
          score: data.score,
          isMalicious: data.isMalicious,
          correctUrl: data.correctUrl || null,
          ruleResults: data.ruleResults || {},
          timestamp: Date.now()
        }
      });
    } catch (e) {
      console.error('[CacheManager] 写入缓存失败:', e);
    }
  }

  /**
   * 清除所有域名缓存
   */
  static async clearAll() {
    try {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(STORAGE_KEYS.DOMAIN_CACHE));
      if (keys.length > 0) {
        await chrome.storage.local.remove(keys);
        console.log(`[CacheManager] 已清除 ${keys.length} 条缓存`);
      }
    } catch (e) {
      console.error('[CacheManager] 清除缓存失败:', e);
    }
  }

  /**
   * 获取缓存统计
   */
  static async getStats() {
    try {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(STORAGE_KEYS.DOMAIN_CACHE));
      const malicious = keys.filter(k => all[k]?.isMalicious).length;
      const safe = keys.length - malicious;
      return { total: keys.length, malicious, safe };
    } catch (e) {
      return { total: 0, malicious: 0, safe: 0 };
    }
  }
}
