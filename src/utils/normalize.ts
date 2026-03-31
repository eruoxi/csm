/**
 * 配置格式规范化工具
 */

import type { ClaudeSettings } from '../types';

/**
 * 规范化 ClaudeSettings 配置
 * 确保配置格式符合标准
 *
 * 注意：仅在 permissions 字段存在时才规范化其结构，
 * 避免强制创建空数组导致配置文件膨胀
 */
export function normalizeSettings(settings: ClaudeSettings): ClaudeSettings {
  const result: ClaudeSettings = { ...settings };

  // 仅在 permissions 存在时规范化其结构
  if (result.permissions) {
    result.permissions = {
      // 仅在字段不存在或为空时才设置默认空数组
      ...(result.permissions.allow === undefined ? {} : { allow: result.permissions.allow }),
      ...(result.permissions.deny === undefined ? {} : { deny: result.permissions.deny })
    };

    // 如果 permissions 对象完全为空，移除它
    if (Object.keys(result.permissions).length === 0) {
      delete result.permissions;
    }
  }

  // 移除 undefined 值，保持格式整洁
  return Object.fromEntries(
    Object.entries(result).filter(([_, v]) => v !== undefined)
  ) as ClaudeSettings;
}
