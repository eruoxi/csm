import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  t,
  setLanguage,
  getLanguage,
  detectLanguage,
  initI18n
} from '../src/i18n/index';

describe('i18n', () => {
  beforeEach(() => {
    // 重置为默认语言
    setLanguage('zh-CN');
    // 清除环境变量
    delete process.env.CSM_LANG;
    vi.unstubAllEnvs();
  });

  describe('detectLanguage', () => {
    it('应该从环境变量 CSM_LANG 检测语言', () => {
      vi.stubEnv('CSM_LANG', 'en-US');
      expect(detectLanguage()).toBe('en-US');
    });

    it('CSM_LANG 应该优先于系统语言', () => {
      vi.stubEnv('CSM_LANG', 'en-US');
      vi.stubEnv('LANG', 'zh_CN.UTF-8');
      expect(detectLanguage()).toBe('en-US');
    });

    it('无效的 CSM_LANG 应该回退到默认语言', () => {
      vi.stubEnv('CSM_LANG', 'invalid');
      expect(detectLanguage()).toBe('zh-CN');
    });

    it('没有环境变量时应该返回默认语言', () => {
      expect(detectLanguage()).toBe('zh-CN');
    });
  });

  describe('setLanguage and getLanguage', () => {
    it('应该能够设置和获取语言', () => {
      setLanguage('en-US');
      expect(getLanguage()).toBe('en-US');
    });

    it('设置无效语言应该保持原语言不变', () => {
      setLanguage('en-US');
      setLanguage('invalid');
      expect(getLanguage()).toBe('en-US');
    });
  });

  describe('t (translate)', () => {
    it('应该翻译存在的键', () => {
      setLanguage('zh-CN');
      expect(t('error.profileNameInvalid')).toBe('名称格式无效。只允许使用字母、数字、连字符和下划线。');
    });

    it('应该翻译英文键', () => {
      setLanguage('en-US');
      expect(t('error.profileNameInvalid')).toBe('Invalid name format. Only letters, numbers, hyphens and underscores are allowed.');
    });

    it('应该支持参数替换', () => {
      setLanguage('zh-CN');
      expect(t('error.profileNotFound', { name: 'test' })).toBe('配置档案 "test" 不存在。');
    });

    it('应该返回键本身如果翻译不存在', () => {
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('应该忽略不存在的参数', () => {
      setLanguage('zh-CN');
      expect(t('error.profileNotFound', { other: 'value' })).toBe('配置档案 "{name}" 不存在。');
    });
  });

  describe('initI18n', () => {
    it('应该初始化并检测语言', () => {
      vi.stubEnv('CSM_LANG', 'en-US');
      initI18n();
      expect(getLanguage()).toBe('en-US');
    });
  });
});
