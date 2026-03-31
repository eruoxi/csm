/**
 * SettingsManager 测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsManager } from '../src/lib/settings';
import type { ClaudeSettings, MergeOptions } from '../src/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Mock mergeSettings
vi.mock('../src/lib/merge', () => ({
  mergeSettings: vi.fn((current: ClaudeSettings, target: ClaudeSettings, options: MergeOptions) => {
    // When noMerge is true, return target directly
    if (options.noMerge) {
      return { ...target };
    }

    // Build the set of fields to merge
    const fieldsToMerge = new Set<string>();
    if (options.merge) {
      for (const field of options.merge) {
        fieldsToMerge.add(field);
      }
    }
    if (options.keepPermissions) {
      fieldsToMerge.add('permissions');
    }
    if (options.keepPlugins) {
      fieldsToMerge.add('enabledPlugins');
    }

    // If no fields to merge, return target as-is
    if (fieldsToMerge.size === 0) {
      return { ...target };
    }

    // Start with a copy of target as the base
    const result: ClaudeSettings = { ...target };

    // Merge each specified field from current into target
    for (const field of fieldsToMerge) {
      const currentValue = current[field as keyof ClaudeSettings];
      if (currentValue !== undefined) {
        if (field === 'permissions') {
          // Merge permissions arrays
          const targetPerms = target.permissions || {};
          const currentPerms = currentValue as { allow?: string[]; deny?: string[] };
          result.permissions = {
            allow: [...(currentPerms.allow || []), ...(targetPerms.allow || [])].filter(Boolean),
            deny: [...(currentPerms.deny || []), ...(targetPerms.deny || [])].filter(Boolean),
          };
        } else if (field === 'env') {
          result.env = { ...currentValue as Record<string, string>, ...target.env };
        } else if (field === 'enabledPlugins') {
          result.enabledPlugins = { ...currentValue as Record<string, boolean>, ...target.enabledPlugins };
        } else {
          (result as Record<string, unknown>)[field] = currentValue;
        }
      }
    }

    return result;
  }),
}));

describe('SettingsManager', () => {
  let manager: SettingsManager;
  let testDir: string;
  let claudeDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'csm-test-', Date.now().toString());
    await fs.ensureDir(testDir);

    // 使用测试目录作为 Claude 目录
    claudeDir = testDir;

    // 使用新的构造函数参数传入测试目录
    manager = new SettingsManager({ claudeDir });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // 清理测试目录
    await fs.remove(testDir);
  });

  describe('read', () => {
    it('应该返回空的 settings 当文件不存在时', async () => {
      const settings = await manager.read();
      expect(settings).toEqual({});
    });

    it('应该正确读取存在的 settings 文件', async () => {
      const mockSettings: ClaudeSettings = {
        env: { NODE_ENV: 'development' },
        permissions: { allow: ['read'], deny: ['write'] },
        enabledPlugins: { plugin1: true },
      };

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, mockSettings);

      const settings = await manager.read();
      expect(settings).toEqual(mockSettings);
    });

    it('应该处理无效的 JSON 文件', async () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeFile(settingsPath, 'invalid json');

      await expect(manager.read()).rejects.toThrow();
    });
  });

  describe('write', () => {
    it('应该正确写入 settings 文件', async () => {
      const settings: ClaudeSettings = {
        env: { API_KEY: 'test' },
        permissions: { allow: ['*'] },
      };

      await manager.write(settings);

      const settingsPath = path.join(claudeDir, 'settings.json');
      const written = await fs.readJson(settingsPath);
      // normalizeSettings 不会强制创建空的 deny 数组
      expect(written).toEqual({
        env: { API_KEY: 'test' },
        permissions: { allow: ['*'] },
      });
    });

    it('应该在写入时创建不存在的目录', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.write(settings);

      const settingsPath = path.join(claudeDir, 'settings.json');
      expect(await fs.pathExists(settingsPath)).toBe(true);
    });

    it('应该覆盖现有的 settings', async () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, { old: 'data' });

      const newSettings: ClaudeSettings = { language: 'zh' };
      await manager.write(newSettings);

      const written = await fs.readJson(settingsPath);
      // normalizeSettings 不会添加空的 permissions 结构
      expect(written).toEqual({
        language: 'zh',
      });
    });
  });

  describe('applyProfile', () => {
    it('应该应用 profile settings（完全替换）', async () => {
      // 先写入现有 settings
      const existingSettings: ClaudeSettings = {
        env: { OLD_VAR: 'old' },
        permissions: { allow: ['old'] },
      };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, existingSettings);

      const profileSettings: ClaudeSettings = {
        env: { NEW_VAR: 'new' },
        permissions: { deny: ['dangerous'] },
      };

      const result = await manager.applyProfile(profileSettings, { noMerge: true });

      expect(result.env).toEqual({ NEW_VAR: 'new' });
      expect(result.permissions?.deny).toContain('dangerous');
    });

    it('应该合并指定字段', async () => {
      const existingSettings: ClaudeSettings = {
        env: { EXISTING: 'value' },
      };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, existingSettings);

      const profileSettings: ClaudeSettings = {
        env: { NEW: 'var' },
      };

      const result = await manager.applyProfile(profileSettings, { merge: ['env'] });

      // 检查 mergeSettings 被调用
      const { mergeSettings } = await import('../src/lib/merge');
      expect(mergeSettings).toHaveBeenCalledWith(
        existingSettings,
        profileSettings,
        { merge: ['env'] }
      );
    });

    it('应该保留 permissions 当 keepPermissions 为 true', async () => {
      const existingSettings: ClaudeSettings = {
        permissions: { allow: ['existing-permission'] },
      };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, existingSettings);

      const profileSettings: ClaudeSettings = {
        permissions: { allow: ['new-permission'] },
      };

      await manager.applyProfile(profileSettings, { keepPermissions: true });

      const { mergeSettings } = await import('../src/lib/merge');
      expect(mergeSettings).toHaveBeenCalledWith(
        existingSettings,
        profileSettings,
        { keepPermissions: true }
      );
    });

    it('应该保留 enabledPlugins 当 keepPlugins 为 true', async () => {
      const existingSettings: ClaudeSettings = {
        enabledPlugins: { plugin1: true },
      };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, existingSettings);

      const profileSettings: ClaudeSettings = {
        enabledPlugins: { plugin2: true },
      };

      await manager.applyProfile(profileSettings, { keepPlugins: true });

      const { mergeSettings } = await import('../src/lib/merge');
      expect(mergeSettings).toHaveBeenCalledWith(
        existingSettings,
        profileSettings,
        { keepPlugins: true }
      );
    });

    it('应该正确写入合并后的 settings', async () => {
      const profileSettings: ClaudeSettings = {
        env: { TEST: 'value' },
        language: 'en',
      };

      await manager.applyProfile(profileSettings);

      const settingsPath = path.join(claudeDir, 'settings.json');
      const written = await fs.readJson(settingsPath);
      expect(written).toBeDefined();
    });
  });

  describe('backup', () => {
    it('应该创建备份文件', async () => {
      // 先创建 settings 文件
      const settings: ClaudeSettings = { language: 'en' };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, settings);

      const backupPath = await manager.backup();

      expect(await fs.pathExists(backupPath)).toBe(true);
      expect(backupPath).toContain('settings-');
      expect(backupPath).toContain('.json');
    });

    it('备份文件应该包含原始 settings 内容', async () => {
      const settings: ClaudeSettings = {
        env: { KEY: 'value' },
        permissions: { allow: ['read'] },
      };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, settings);

      const backupPath = await manager.backup();
      const backupContent = await fs.readJson(backupPath);

      expect(backupContent).toEqual(settings);
    });

    it('应该在备份目录不存在时创建它', async () => {
      const settings: ClaudeSettings = { language: 'zh' };
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, settings);

      const backupPath = await manager.backup();

      const backupDir = path.dirname(backupPath);
      expect(await fs.pathExists(backupDir)).toBe(true);
    });

    it('当 settings 文件不存在时应该抛出错误', async () => {
      await expect(manager.backup()).rejects.toThrow();
    });

    it('备份文件名应该包含时间戳', async () => {
      const settings: ClaudeSettings = {};
      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJson(settingsPath, settings);

      const backupPath = await manager.backup();

      // 检查文件名格式: settings-YYYYMMDDHHMMSS.json 或类似
      const filename = path.basename(backupPath);
      expect(filename).toMatch(/^settings-.*\.json$/);
    });
  });
});