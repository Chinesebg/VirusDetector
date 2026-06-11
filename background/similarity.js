/**
 * SimHash 文本相似度计算工具
 * 用于比较页面内容与官方网站内容的相似度
 * 使用64位SimHash + 海明距离
 */
export class SimHash {
  /**
   * @param {string} text - 输入文本
   * @param {number} [bits=64] - 哈希位数
   */
  constructor(text, bits = 64) {
    this.bits = bits;
    this.hash = this.compute(text, bits);
  }

  /**
   * 计算SimHash值
   * @param {string} text
   * @param {number} bits
   * @returns {bigint} SimHash值（作为BigInt）
   */
  compute(text, bits) {
    const tokens = this.tokenize(text);
    const vector = new Array(bits).fill(0);

    for (const token of tokens) {
      const hash = this._simpleHash(token);
      for (let i = 0; i < bits; i++) {
        // 检查第i位
        if (hash & (1 << (i % 32))) {
          vector[i] += 1;
        } else {
          vector[i] -= 1;
        }
      }
    }

    // 构建最终哈希
    let result = 0n;
    for (let i = 0; i < bits; i++) {
      if (vector[i] >= 0) {
        result |= (1n << BigInt(i));
      }
    }

    return result;
  }

  /**
   * 分词 - 中文使用字符二元组 + 英文单词
   * @param {string} text
   * @returns {string[]}
   */
  tokenize(text) {
    const tokens = [];
    // 移除HTML标签
    const cleaned = text.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').toLowerCase();
    // 移除多余空白
    const normalized = cleaned.replace(/\s+/g, ' ').trim();

    if (normalized.length === 0) return tokens;

    // 字符二元组（对中文和英文都有效）
    for (let i = 0; i < normalized.length - 1; i++) {
      tokens.push(normalized.substring(i, i + 2));
    }

    // 单词分词（对英文有效）
    const words = normalized.split(/\s+/).filter(w => w.length > 1);
    tokens.push(...words);

    // 三元组（增加精度）
    for (let i = 0; i < normalized.length - 2; i++) {
      tokens.push(normalized.substring(i, i + 3));
    }

    return tokens;
  }

  /**
   * 计算与另一个SimHash的海明距离
   * @param {SimHash|bigint} other - 另一个SimHash对象或哈希值
   * @returns {number} 海明距离
   */
  hammingDistance(other) {
    const otherHash = other instanceof SimHash ? other.hash : other;
    const xor = this.hash ^ otherHash;
    return this._popcount(xor);
  }

  /**
   * 判断是否相似
   * @param {SimHash} other
   * @param {number} [threshold=10] - 海明距离阈值
   * @returns {boolean}
   */
  isSimilar(other, threshold = 10) {
    return this.hammingDistance(other) < threshold;
  }

  /**
   * 简单的字符串哈希函数
   * @param {string} str
   * @returns {number} 32位哈希值
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // 转换为32位整数
    }
    return hash >>> 0; // 无符号
  }

  /**
   * 计算BigInt中1的个数（popcount）
   * @param {bigint} n
   * @returns {number}
   */
  _popcount(n) {
    let count = 0;
    while (n) {
      count += Number(n & 1n);
      n >>= 1n;
    }
    return count;
  }

  /**
   * 将SimHash转为十六进制字符串（便于存储）
   * @returns {string}
   */
  toHex() {
    return '0x' + this.hash.toString(16).padStart(Math.ceil(this.bits / 4), '0');
  }

  /**
   * 从十六进制字符串恢复SimHash
   * @param {string} hex
   * @param {number} [bits=64]
   * @returns {bigint}
   */
  static fromHex(hex, bits = 64) {
    return BigInt(hex);
  }
}

/**
 * 简化的文本相似度计算器
 * 使用TF（词频）向量的余弦相似度作为SimHash的替代方案
 * 适用于较短的文本比较
 */
export class TextSimilarity {
  /**
   * 计算两个文本的余弦相似度
   * @param {string} text1
   * @param {string} text2
   * @returns {number} 0-1之间的相似度
   */
  static cosineSimilarity(text1, text2) {
    const tokens1 = this._getTermFrequency(text1);
    const tokens2 = this._getTermFrequency(text2);

    // 获取所有唯一的词
    const allTerms = new Set([...tokens1.keys(), ...tokens2.keys()]);

    // 构建向量
    const vec1 = [];
    const vec2 = [];
    for (const term of allTerms) {
      vec1.push(tokens1.get(term) || 0);
      vec2.push(tokens2.get(term) || 0);
    }

    // 计算余弦相似度
    const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
  }

  /**
   * 获取文本的词频映射
   * @param {string} text
   * @returns {Map<string, number>}
   */
  static _getTermFrequency(text) {
    const freq = new Map();
    const cleaned = text.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').toLowerCase();

    // 中文二元组分词
    for (let i = 0; i < cleaned.length - 1; i++) {
      const bigram = cleaned.substring(i, i + 2);
      freq.set(bigram, (freq.get(bigram) || 0) + 1);
    }

    // 英文单词
    const words = cleaned.split(/[\s,.;:!?]+/).filter(w => w.length > 1);
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    return freq;
  }
}
