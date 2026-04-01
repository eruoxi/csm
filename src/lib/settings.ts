/**
 * SettingsManager - 管理 Claude Code 设置文件
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { getClaudeDir, getSettingsPath, getBackupsDir } from '../utils/file';
import { writeJsonAtomic } from '../utils/atomicWrite';
import { mergeSettings } from './merge';
import { normalizeSettings } from '../utils/normalize';
import type { ClaudeSettings, MergeOptions } from '../types';
import { t } from '../i18n';
import { getErrorMessage } from '../utils/errors';

/** 默认最大备份数量 */
const DEFAULT_MAX_BACKUPS = 10;

/**
 * SettingsManager 配置选项
 */
export interface SettingsManagerOptions {
  /** 自定义 Claude 目录路径（用于测试） */
  claudeDir?: string;
  /** 最大备份数量，默认 10 */
  maxBackups?: number;
}

/**
 * Claude Code 设置管理器
 */
export class SettingsManager {
  private claudeDir: string;
  private settingsPath: string;
  private backupDir: string;
  private maxBackups: number;

  constructor(options: SettingsManagerOptions = {}) {
    // 自定义目录用于测试，否则使用真实路径
    this.claudeDir = options.claudeDir || getClaudeDir();
    this.settingsPath = options.claudeDir
      ? path.join(options.claudeDir, 'settings.json')
      : getSettingsPath();  // 生产环境: ~/.claude/settings.json
    this.backupDir = options.claudeDir
      ? path.join(options.claudeDir, 'backups')
      : getBackupsDir();  // 生产环境: ~/.claude/csm/backups
    this.maxBackups = options.maxBackups ?? DEFAULT_MAX_BACKUPS;
  }

  /**
   * 读取当前 settings
   */
  async read(): Promise<ClaudeSettings> {
    try {
      if (!(await fs.pathExists(this.settingsPath))) {
        return {};
      }
      const content = await fs.readJson(this.settingsPath);
      return content as ClaudeSettings;
    } catch (error) {
      throw new Error(t('internal.readSettingsFailed', { error: getErrorMessage(error) }));
    }
  }

  /**
   * 写入 settings（使用原子写入）
   */
  async write(settings: ClaudeSettings): Promise<void> {
    try {
      await fs.ensureDir(this.claudeDir);
      const normalized = normalizeSettings(settings);
      await writeJsonAtomic(this.settingsPath, normalized, { spaces: 2 });
    } catch (error) {
      throw new Error(t('internal.writeSettingsFailed', { error: getErrorMessage(error) }));
    }
  }

  /**
   * 应用 Profile（支持合并）
   * 具有原子性：先备份再写入，失败时可以恢复
   */
  async applyProfile(
    profileSettings: ClaudeSettings,
    options: MergeOptions = {}
  ): Promise<ClaudeSettings> {
    // 读取现有 settings
    const currentSettings = await this.read();

    // 合并 settings
    const mergedSettings = mergeSettings(currentSettings, profileSettings, options);

    // 如果 settings 文件存在，先创建备份
    let backupPath: string | null = null;
    const settingsExists = await fs.pathExists(this.settingsPath);

    if (settingsExists) {
      try {
        backupPath = await this.backup();
      } catch {
        // 备份失败时继续，但记录警告
        console.warn(t('warn.backupCreateFailed'));
      }
    }

    try {
      // 写入合并后的 settings
      await this.write(mergedSettings);
      return mergedSettings;
    } catch (writeError) {
      // 写入失败，尝试恢复备份
      if (backupPath && await fs.pathExists(backupPath)) {
        try {
          await fs.copy(backupPath, this.settingsPath);
          console.warn(t('warn.writeFailedRollback'));
        } catch {
          // 恢复失败，严重错误
          throw new Error(
            t('internal.restoreBackupFailed', { error: getErrorMessage(writeError) })
          );
        }
      }
      throw writeError;
    }
  }

  /**
   * 备份当前 settings
   * @returns 备份文件路径
   */
  async backup(): Promise<string> {
    // 检查 settings 文件是否存在
    if (!(await fs.pathExists(this.settingsPath))) {
      throw new Error(t('internal.noSettingsToBackup'));
    }

    try {
      // 确保备份目录存在
      await fs.ensureDir(this.backupDir);

      // 清理旧备份
      await this.cleanOldBackups();

      // 生成备份文件名
      const timestamp = this.getTimestamp();
      const backupFileName = `settings-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // 复制文件
      await fs.copy(this.settingsPath, backupPath);

      return backupPath;
    } catch (error) {
      throw new Error(t('internal.createBackupFailed', { error: getErrorMessage(error) }));
    }
  }

  /**
   * 清理旧备份文件，保留最新的 maxBackups 个
   */
  async cleanOldBackups(): Promise<number> {
    if (!(await fs.pathExists(this.backupDir))) {
      return 0;
    }

    try {
      // 获取所有备份文件
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('settings-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f)
        }));

      // 如果备份数量未超过限制，不需要清理
      if (backupFiles.length <= this.maxBackups) {
        return 0;
      }

      // 按文件名排序（时间戳格式，字符串排序即可）
      backupFiles.sort((a, b) => a.name.localeCompare(b.name));

      // 删除最旧的备份
      const toDelete = backupFiles.slice(0, backupFiles.length - this.maxBackups);
      let deletedCount = 0;

      for (const file of toDelete) {
        try {
          await fs.remove(file.path);
          deletedCount++;
        } catch {
          // 忽略单个文件删除失败
        }
      }

      return deletedCount;
    } catch {
      return 0;
    }
  }

  /**
   * 获取备份文件列表
   */
  async listBackups(): Promise<{ name: string; path: string; size: number; createdAt: Date }[]> {
    if (!(await fs.pathExists(this.backupDir))) {
      return [];
    }

    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('settings-') && f.endsWith('.json'));

      // 并行获取所有文件状态
      const statsPromises = backupFiles.map(async name => {
        const filePath = path.join(this.backupDir, name);
        try {
          const stats = await fs.stat(filePath);
          // 从文件名解析时间戳
          const timestampMatch = name.match(/settings-(\d+)\.json/);
          let createdAt = stats.birthtime;
          if (timestampMatch) {
            const ts = timestampMatch[1];
            // 解析时间戳 YYYYMMDDHHmmssSSS
            createdAt = new Date(
              parseInt(ts.slice(0, 4)),
              parseInt(ts.slice(4, 6)) - 1,
              parseInt(ts.slice(6, 8)),
              parseInt(ts.slice(8, 10)),
              parseInt(ts.slice(10, 12)),
              parseInt(ts.slice(12, 14)),
              parseInt(ts.slice(14, 17)) || 0
            );
          }
          return { name, path: filePath, size: stats.size, createdAt };
        } catch {
          return null;
        }
      });

      const results = (await Promise.all(statsPromises)).filter((r): r is NonNullable<typeof r> => r !== null);

      // 按创建时间倒序
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
      return [];
    }
  }

  /**
   * 生成时间戳字符串
   * 格式: YYYYMMDDHHmmssSSS (毫秒级精度)
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}${ms}`;
  }

  /**
   * 获取 settings 文件路径
   */
  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * 获取备份目录路径
   */
  getBackupDir(): string {
    return this.backupDir;
  }

  /**
   * 获取 Claude 目录路径
   */
  getClaudeDir(): string {
    return this.claudeDir;
  }
}