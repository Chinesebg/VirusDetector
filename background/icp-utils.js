/**
 * ICP备案号检测工具
 * 支持所有中国省份简称的正则匹配和模糊查找
 */

// 中国所有省份/自治区/直辖市简称
const PROVINCE_ABBREVIATIONS = [
  '京', // 北京
  '津', // 天津
  '沪', // 上海
  '渝', // 重庆
  '冀', // 河北
  '豫', // 河南
  '云', '滇', // 云南（滇为旧称）
  '辽', // 辽宁
  '黑', // 黑龙江
  '湘', // 湖南
  '皖', // 安徽
  '鲁', // 山东
  '新', // 新疆
  '苏', // 江苏
  '浙', // 浙江
  '赣', // 江西
  '鄂', // 湖北
  '桂', // 广西
  '甘', '陇', // 甘肃（陇为旧称）
  '晋', // 山西
  '蒙', // 内蒙古
  '陕', '秦', // 陕西（秦为旧称）
  '吉', // 吉林
  '闽', // 福建
  '贵', '黔', // 贵州（黔为旧称）
  '粤', // 广东
  '川', '蜀', // 四川（蜀为旧称）
  '青', // 青海
  '藏', // 西藏
  '琼', // 海南
  '宁', // 宁夏
];

// 省份简称正则片段
const PROVINCE_PATTERN = PROVINCE_ABBREVIATIONS.join('|');

/**
 * ICP备案号工具类
 */
export class IcpUtils {
  /**
   * 完整的ICP备案号正则
   * 格式: 省份简称 + ICP备 + 6-8位数字 + 号(-附属编号可选)
   * 同时匹配ICP证（经营性）
   */
  static ICP_FULL_REGEX = new RegExp(
    `(${PROVINCE_PATTERN})ICP[备证]\\d{6,8}号(-\\d+)?`,
    'g'
  );

  /**
   * 简化匹配：省份简称 + ICP备/证 + 数字
   * 用于宽松匹配（允许缺失"号"字）
   */
  static ICP_SIMPLE_REGEX = new RegExp(
    `(${PROVINCE_PATTERN})ICP[备证]\\d{6,8}`,
    'g'
  );

  /**
   * 公安备案号正则
   * 格式: 省份简称 + 公网安备 + 数字 + 号
   */
  static POLICE_BEIAN_REGEX = new RegExp(
    `(${PROVINCE_PATTERN})公网安备\\d{10,}号`,
    'g'
  );

  /**
   * 在文本中搜索ICP备案号
   * @param {string} pageText - 页面全文
   * @param {string[]} [domIcpStrings] - 从DOM特定位置提取的文本
   * @returns {{ found: boolean, numbers: string[], source: string }}
   */
  static searchIcpNumber(pageText, domIcpStrings = []) {
    const results = [];
    let source = 'none';

    // 优先检查DOM特定位置（更可靠）
    if (domIcpStrings && domIcpStrings.length > 0) {
      for (const str of domIcpStrings) {
        const matches = str.match(this.ICP_FULL_REGEX);
        if (matches) {
          results.push(...matches);
          source = 'dom_footer';
        }
      }

      // 如果完整正则没匹配到，尝试简化正则
      if (results.length === 0) {
        for (const str of domIcpStrings) {
          const matches = str.match(this.ICP_SIMPLE_REGEX);
          if (matches) {
            // 为匹配添加"号"字以规范化
            results.push(...matches.map(m => m + '号'));
            source = 'dom_footer_simple';
          }
        }
      }
    }

    // 如果DOM没找到，搜索整个页面文本
    if (results.length === 0 && pageText) {
      const fullMatches = pageText.match(this.ICP_FULL_REGEX);
      if (fullMatches) {
        results.push(...fullMatches);
        source = 'page_text';
      } else {
        const simpleMatches = pageText.match(this.ICP_SIMPLE_REGEX);
        if (simpleMatches) {
          results.push(...simpleMatches.map(m => m + '号'));
          source = 'page_text_simple';
        }
      }
    }

    // 去重
    const unique = [...new Set(results)];

    return {
      found: unique.length > 0,
      numbers: unique,
      source,
      count: unique.length
    };
  }

  /**
   * 检查文本是否包含ICP备案号（模糊匹配）
   * @param {string} text
   * @returns {boolean}
   */
  static hasIcpNumber(text) {
    if (!text) return false;
    // 重置lastIndex
    this.ICP_SIMPLE_REGEX.lastIndex = 0;
    return this.ICP_SIMPLE_REGEX.test(text);
  }

  /**
   * 获取ICP备案号的省份信息
   * @param {string} icpNumber - ICP备案号
   * @returns {{ province: string, isProvincialCapital: boolean }|null}
   */
  static parseIcpNumber(icpNumber) {
    if (!icpNumber) return null;

    for (const abbr of PROVINCE_ABBREVIATIONS) {
      if (icpNumber.startsWith(abbr)) {
        return {
          province: this.getProvinceName(abbr),
          abbreviation: abbr,
          type: icpNumber.includes('ICP证') ? 'commercial' : 'filing'
        };
      }
    }
    return null;
  }

  /**
   * 省份简称 -> 全称映射
   */
  static getProvinceName(abbreviation) {
    const map = {
      '京': '北京', '津': '天津', '沪': '上海', '渝': '重庆',
      '冀': '河北', '豫': '河南', '云': '云南', '滇': '云南',
      '辽': '辽宁', '黑': '黑龙江', '湘': '湖南', '皖': '安徽',
      '鲁': '山东', '新': '新疆', '苏': '江苏', '浙': '浙江',
      '赣': '江西', '鄂': '湖北', '桂': '广西', '甘': '甘肃',
      '陇': '甘肃', '晋': '山西', '蒙': '内蒙古', '陕': '陕西',
      '秦': '陕西', '吉': '吉林', '闽': '福建', '贵': '贵州',
      '黔': '贵州', '粤': '广东', '川': '四川', '蜀': '四川',
      '青': '青海', '藏': '西藏', '琼': '海南', '宁': '宁夏'
    };
    return map[abbreviation] || '未知';
  }

  /**
   * 获取所有省份简称
   * @returns {string[]}
   */
  static getAllProvinceAbbreviations() {
    return [...PROVINCE_ABBREVIATIONS];
  }

  /**
   * 从文本中提取所有可能的备案号候选
   * 包括非标准格式（如仅包含"备案"、"ICP"等关键词）
   * @param {string} text
   * @returns {{ candidates: string[], hasIcpKeyword: boolean }}
   */
  static extractCandidates(text) {
    if (!text) return { candidates: [], hasIcpKeyword: false };

    const hasIcpKeyword = /(?:ICP|icp|备案|beian|BeiAn|BEIAN)/.test(text);
    const candidates = [];

    // 匹配任何包含ICP和数字的行
    const lines = text.split(/[\n\r]+/);
    for (const line of lines) {
      if (/ICP.*\d{4,}/i.test(line) || /\d{4,}.*ICP/i.test(line) ||
          /备案.*\d{4,}/.test(line) || /\d{4,}.*备案/.test(line)) {
        candidates.push(line.trim().substring(0, 200));
      }
    }

    return { candidates, hasIcpKeyword };
  }
}
