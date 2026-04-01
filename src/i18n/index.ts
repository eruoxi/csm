/**
 * CSM 国际化模块
 */

import zhCN from './zh-CN.json';
import enUS from './en-US.json';
import type { SupportedLanguage } from '../types';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['zh-CN', 'en-US'];

export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English'
};

export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map(lang => ({
  name: LANGUAGE_DISPLAY_NAMES[lang],
  value: lang
}));

const translations: Record<SupportedLanguage, Record<string, unknown>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

let currentLanguage: SupportedLanguage = 'zh-CN';

export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * 检测系统语言
 */
export function detectLanguage(): SupportedLanguage {
  // 1. 检查环境变量 CSM_LANG
  const csmLang = process.env.CSM_LANG;
  if (csmLang && isValidLanguage(csmLang)) {
    return csmLang;
  }

  // 2. 检查系统语言环境变量
  const sysLang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES;
  if (sysLang) {
    // 提取语言代码 (如 zh_CN.UTF-8 -> zh-CN)
    const langCode = sysLang.split('.')[0].replace('_', '-');
    if (langCode.startsWith('zh')) {
      return 'zh-CN';
    }
    if (langCode.startsWith('en')) {
      return 'en-US';
    }
  }

  // 3. 使用 Intl API 检测
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale.startsWith('zh')) {
      return 'zh-CN';
    }
    if (locale.startsWith('en')) {
      return 'en-US';
    }
  } catch {
    // 忽略错误
  }

  // 4. 默认中文
  return 'zh-CN';
}

export function setLanguage(lang: string): void {
  if (isValidLanguage(lang)) {
    currentLanguage = lang;
  }
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * 翻译函数
 * 支持嵌套键 (如 "error.profileNotFound") 和参数占位符 (如 {name})
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = translations[currentLanguage];

  const value = key.split('.').reduce<unknown>((obj, k) => {
    if (obj && typeof obj === 'object' && k in obj) {
      return (obj as Record<string, unknown>)[k];
    }
    return undefined;
  }, dict);

  if (typeof value !== 'string') {
    return key;
  }

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
    });
  }

  return value;
}

/**
 * 初始化 i18n
 * 优先级: savedLanguage > 环境变量 > 系统检测 > 默认中文
 */
export function initI18n(savedLanguage?: SupportedLanguage): void {
  currentLanguage = savedLanguage ?? detectLanguage();
}
