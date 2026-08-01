/**
 * DomainDatabase 行为测试：断言官方域名精确匹配、子域名命名空间归属
 * 与跨命名空间仿冒检测（detectSpoof），并验证 Guard A / Rule B 边界约束。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { DomainDatabase } from '../background/domain-database.js';

// ==================== 官方域名精确匹配 ====================

test('GitLab is registered as an official developer platform', () => {
  const entry = DomainDatabase.findByDomain('gitlab.com');
  assert.ok(entry);
  assert.equal(entry.name, 'GitLab');
});

// ==================== 子域名 → 命名空间归属 ====================

test('wubi.sogou.com — 命名空间归属（不应被误判）', () => {
  const entry = DomainDatabase.findByDomain('wubi.sogou.com');
  assert.ok(entry, 'wubi.sogou.com 应通过命名空间索引查到归属品牌');
  assert.ok(entry.name.includes('搜狗'));
});

test('wubi.sogou.com — detectSpoof 返回 null（Guard A 命中）', () => {
  assert.equal(DomainDatabase.detectSpoof('wubi.sogou.com'), null);
});

// ==================== 跨命名空间仿冒检测 ====================

test('sogou.evil.com — 仿冒检测应触发', () => {
  const spoof = DomainDatabase.detectSpoof('sogou.evil.com');
  assert.ok(spoof, 'evil.com 不归搜狗，应检测为仿冒');
  assert.equal(spoof.matchType, 'segment_exact_match');
});

test('gitlab-login.example.com — 仿冒检测应触发', () => {
  const spoof = DomainDatabase.detectSpoof('gitlab-login.example.com');
  assert.ok(spoof);
  assert.equal(spoof.entry.name, 'GitLab');
});

// ==================== Rule B 边界约束 ====================

test('xsogoux.com — 短关键词在标签中间，Rule B 不触发', () => {
  assert.equal(DomainDatabase.detectSpoof('xsogoux.com'), null);
});

test('xbaidux.com — 短关键词在标签中间，Rule B 不触发', () => {
  assert.equal(DomainDatabase.detectSpoof('xbaidux.com'), null);
});

test('sogoutech.com — 短关键词在标签开头，Rule B 触发', () => {
  const spoof = DomainDatabase.detectSpoof('sogoutech.com');
  assert.ok(spoof, 'sogou 在 sogoutech 开头 → 边界匹配');
});

// ==================== 去连字符检测 ====================

test('sogou-phish.evil.com — 去连字符后段匹配', () => {
  const spoof = DomainDatabase.detectSpoof('sogou-phish.evil.com');
  assert.ok(spoof, 'sogou-phish → 段 sogou 匹配关键词');
});
