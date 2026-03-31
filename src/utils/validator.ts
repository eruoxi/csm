/**
 * 配置验证工具
 */
import type { ClaudeSettings, ValidationResult } from '../types';

// Profile 名称最大长度
const MAX_PROFILE_NAME_LENGTH = 64;

/**
 * 验证 Profile 名称
 * - 只允许字母、数字、连字符、下划线
 * - 防止路径遍历攻击（禁止 .. / \ 等）
 * - 限制长度
 */
export function validateProfileName(name: string): boolean {
  if (!name || name.length === 0 || name.length > MAX_PROFILE_NAME_LENGTH) {
    return false;
  }

  // 只允许安全字符
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  return nameRegex.test(name);
}

/**
 * 验证 Profile 名称并返回详细结果
 */
export function validateProfileNameWithResult(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.length === 0) {
    errors.push('配置名称不能为空');
  } else if (name.length > MAX_PROFILE_NAME_LENGTH) {
    errors.push(`配置名称长度不能超过 ${MAX_PROFILE_NAME_LENGTH} 个字符`);
  } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    errors.push('配置名称只能包含字母、数字、连字符和下划线');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 内部验证函数：验证 settings 并收集错误
 */
function validateSettingsInternal(settings: unknown, collectDetails: boolean): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('配置必须是一个非空对象');
    return { valid: false, errors };
  }

  const s = settings as Record<string, unknown>;

  // 验证 env 字段
  if (s.env !== undefined) {
    if (typeof s.env !== 'object' || s.env === null) {
      errors.push('env 字段必须是一个对象');
    } else {
      const envEntries = Object.entries(s.env as Record<string, unknown>);
      for (const [key, value] of envEntries) {
        if (typeof value !== 'string') {
          if (collectDetails) {
            errors.push(`env.${key} 的值必须是字符串，实际为 ${typeof value}`);
          } else {
            return { valid: false, errors: ['env 字段包含非字符串值'] };
          }
        }
      }
    }
  }

  // 验证 permissions 字段
  if (s.permissions !== undefined) {
    if (typeof s.permissions !== 'object' || s.permissions === null) {
      errors.push('permissions 字段必须是一个对象');
    } else {
      const perm = s.permissions as Record<string, unknown>;

      if (perm.allow !== undefined) {
        if (!Array.isArray(perm.allow)) {
          errors.push('permissions.allow 必须是数组');
        } else {
          const invalidItems = perm.allow.filter(item => typeof item !== 'string');
          if (invalidItems.length > 0) {
            if (collectDetails) {
              errors.push(`permissions.allow 包含 ${invalidItems.length} 个非字符串元素`);
            } else {
              return { valid: false, errors: ['permissions.allow 包含非字符串元素'] };
            }
          }
        }
      }

      if (perm.deny !== undefined) {
        if (!Array.isArray(perm.deny)) {
          errors.push('permissions.deny 必须是数组');
        } else {
          const invalidItems = perm.deny.filter(item => typeof item !== 'string');
          if (invalidItems.length > 0) {
            if (collectDetails) {
              errors.push(`permissions.deny 包含 ${invalidItems.length} 个非字符串元素`);
            } else {
              return { valid: false, errors: ['permissions.deny 包含非字符串元素'] };
            }
          }
        }
      }
    }
  }

  // 验证 enabledPlugins 字段
  if (s.enabledPlugins !== undefined) {
    if (typeof s.enabledPlugins !== 'object' || s.enabledPlugins === null) {
      errors.push('enabledPlugins 字段必须是一个对象');
    } else {
      const plugins = s.enabledPlugins as Record<string, unknown>;
      for (const [key, value] of Object.entries(plugins)) {
        if (typeof value !== 'boolean') {
          if (collectDetails) {
            errors.push(`enabledPlugins.${key} 的值必须是布尔值，实际为 ${typeof value}`);
          } else {
            return { valid: false, errors: ['enabledPlugins 字段包含非布尔值'] };
          }
        }
      }
    }
  }

  // 验证其他已知字段
  if (s.language !== undefined && typeof s.language !== 'string') {
    if (collectDetails) {
      errors.push(`language 字段必须是字符串，实际为 ${typeof s.language}`);
    } else {
      return { valid: false, errors: ['language 字段类型无效'] };
    }
  }
  if (s.effortLevel !== undefined && typeof s.effortLevel !== 'string') {
    if (collectDetails) {
      errors.push(`effortLevel 字段必须是字符串，实际为 ${typeof s.effortLevel}`);
    } else {
      return { valid: false, errors: ['effortLevel 字段类型无效'] };
    }
  }
  if (s.autoUpdatesChannel !== undefined && typeof s.autoUpdatesChannel !== 'string') {
    if (collectDetails) {
      errors.push(`autoUpdatesChannel 字段必须是字符串，实际为 ${typeof s.autoUpdatesChannel}`);
    } else {
      return { valid: false, errors: ['autoUpdatesChannel 字段类型无效'] };
    }
  }
  if (s.autoMemoryEnabled !== undefined && typeof s.autoMemoryEnabled !== 'boolean') {
    if (collectDetails) {
      errors.push(`autoMemoryEnabled 字段必须是布尔值，实际为 ${typeof s.autoMemoryEnabled}`);
    } else {
      return { valid: false, errors: ['autoMemoryEnabled 字段类型无效'] };
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证 Settings 结构
 */
export function validateSettings(settings: ClaudeSettings): boolean {
  return validateSettingsInternal(settings, false).valid;
}

/**
 * 验证 Settings 结构并返回详细结果
 */
export function validateSettingsWithResult(settings: unknown): ValidationResult {
  return validateSettingsInternal(settings, true);
}
