/**
 * 配置验证工具
 */
import type { ClaudeSettings, ValidationResult } from '../types';
import { t } from '../i18n';

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
    errors.push(t('validation.nameEmpty'));
  } else if (name.length > MAX_PROFILE_NAME_LENGTH) {
    errors.push(t('validation.nameTooLong', { max: MAX_PROFILE_NAME_LENGTH }));
  } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    errors.push(t('validation.nameInvalidChars'));
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
    errors.push(t('validation.settingsNotObject'));
    return { valid: false, errors };
  }

  const s = settings as Record<string, unknown>;

  // 验证 env 字段
  if (s.env !== undefined) {
    if (typeof s.env !== 'object' || s.env === null) {
      errors.push(t('validation.envNotObject'));
    } else {
      const envEntries = Object.entries(s.env as Record<string, unknown>);
      for (const [key, value] of envEntries) {
        if (typeof value !== 'string') {
          if (collectDetails) {
            errors.push(t('validation.envValueNotString', { key, type: typeof value }));
          } else {
            return { valid: false, errors: [t('validation.envNonStringValue')] };
          }
        }
      }
    }
  }

  // 验证 permissions 字段
  if (s.permissions !== undefined) {
    if (typeof s.permissions !== 'object' || s.permissions === null) {
      errors.push(t('validation.permissionsNotObject'));
    } else {
      const perm = s.permissions as Record<string, unknown>;

      if (perm.allow !== undefined) {
        if (!Array.isArray(perm.allow)) {
          errors.push(t('validation.permissionsAllowNotArray'));
        } else {
          const invalidItems = perm.allow.filter(item => typeof item !== 'string');
          if (invalidItems.length > 0) {
            if (collectDetails) {
              errors.push(t('validation.permissionsAllowInvalid', { count: invalidItems.length }));
            } else {
              return { valid: false, errors: [t('validation.permissionsAllowInvalid', { count: invalidItems.length })] };
            }
          }
        }
      }

      if (perm.deny !== undefined) {
        if (!Array.isArray(perm.deny)) {
          errors.push(t('validation.permissionsDenyNotArray'));
        } else {
          const invalidItems = perm.deny.filter(item => typeof item !== 'string');
          if (invalidItems.length > 0) {
            if (collectDetails) {
              errors.push(t('validation.permissionsDenyInvalid', { count: invalidItems.length }));
            } else {
              return { valid: false, errors: [t('validation.permissionsDenyInvalid', { count: invalidItems.length })] };
            }
          }
        }
      }
    }
  }

  // 验证 enabledPlugins 字段
  if (s.enabledPlugins !== undefined) {
    if (typeof s.enabledPlugins !== 'object' || s.enabledPlugins === null) {
      errors.push(t('validation.pluginsNotObject'));
    } else {
      const plugins = s.enabledPlugins as Record<string, unknown>;
      for (const [key, value] of Object.entries(plugins)) {
        if (typeof value !== 'boolean') {
          if (collectDetails) {
            errors.push(t('validation.pluginValueNotBoolean', { key, type: typeof value }));
          } else {
            return { valid: false, errors: [t('validation.pluginsNonBooleanValue')] };
          }
        }
      }
    }
  }

  // 验证其他已知字段
  if (s.language !== undefined && typeof s.language !== 'string') {
    if (collectDetails) {
      errors.push(t('validation.fieldNotString', { field: 'language', type: typeof s.language }));
    } else {
      return { valid: false, errors: [t('validation.fieldInvalidType', { field: 'language' })] };
    }
  }
  if (s.effortLevel !== undefined && typeof s.effortLevel !== 'string') {
    if (collectDetails) {
      errors.push(t('validation.fieldNotString', { field: 'effortLevel', type: typeof s.effortLevel }));
    } else {
      return { valid: false, errors: [t('validation.fieldInvalidType', { field: 'effortLevel' })] };
    }
  }
  if (s.autoUpdatesChannel !== undefined && typeof s.autoUpdatesChannel !== 'string') {
    if (collectDetails) {
      errors.push(t('validation.fieldNotString', { field: 'autoUpdatesChannel', type: typeof s.autoUpdatesChannel }));
    } else {
      return { valid: false, errors: [t('validation.fieldInvalidType', { field: 'autoUpdatesChannel' })] };
    }
  }
  if (s.autoMemoryEnabled !== undefined && typeof s.autoMemoryEnabled !== 'boolean') {
    if (collectDetails) {
      errors.push(t('validation.fieldNotBoolean', { field: 'autoMemoryEnabled', type: typeof s.autoMemoryEnabled }));
    } else {
      return { valid: false, errors: [t('validation.fieldInvalidType', { field: 'autoMemoryEnabled' })] };
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
