/**
 * 备份验证工具
 *
 * 验证备份文件的完整性和有效性
 */

import fs from 'fs-extra';
import path from 'path';
import unzipper from 'unzipper';
import { t } from '../i18n';

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contents: {
    hasSettings: boolean;
    hasState: boolean;
    profileCount: number;
    profiles: string[];
  };
  /** 是否存在路径遍历风险 */
  hasPathTraversalRisk?: boolean;
}

/**
 * 检查 ZIP 条目路径是否存在路径遍历攻击风险
 * @param entryPath - ZIP 条目路径
 * @returns 是否安全
 */
export function isEntryPathSafe(entryPath: string): boolean {
  // 规范化路径，处理正斜杠和反斜杠
  const normalized = entryPath.replace(/\\/g, '/');

  // 检查是否以 / 开头（绝对路径）
  if (normalized.startsWith('/')) {
    return false;
  }

  // 检查是否包含 .. 路径遍历
  const parts = normalized.split('/');
  let depth = 0;
  for (const part of parts) {
    if (part === '..') {
      depth--;
      if (depth < 0) {
        return false; // 尝试跳出根目录
      }
    } else if (part !== '.' && part !== '') {
      depth++;
    }
  }

  return true;
}

/**
 * 验证备份文件完整性
 *
 * @param backupPath - 备份文件路径
 * @returns 验证结果
 */
export async function validateBackup(backupPath: string): Promise<BackupValidationResult> {
  const result: BackupValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    contents: {
      hasSettings: false,
      hasState: false,
      profileCount: 0,
      profiles: []
    }
  };

  // 1. 检查文件存在
  if (!(await fs.pathExists(backupPath))) {
    result.valid = false;
    result.errors.push(t('backup.fileNotExist'));
    return result;
  }

  // 2. 检查文件扩展名
  if (!backupPath.endsWith('.zip')) {
    result.valid = false;
    result.errors.push(t('backup.mustBeZip'));
    return result;
  }

  // 3. 检查文件大小
  try {
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      result.valid = false;
      result.errors.push(t('error.backupEmpty'));
      return result;
    }
    if (stats.size > 100 * 1024 * 1024) { // 100MB
      result.warnings.push(t('warn.backupLarge'));
    }
  } catch (error) {
    result.valid = false;
    result.errors.push(t('error.backupCorrupted', { error: error instanceof Error ? error.message : String(error) }));
    return result;
  }

  // 4. 读取 ZIP 文件内容
  try {
    const entries = await readZipEntries(backupPath);

    // 检查路径遍历风险
    for (const entry of entries) {
      if (!isEntryPathSafe(entry)) {
        result.valid = false;
        result.errors.push(t('error.unsafePathDetected', { path: entry }));
        result.hasPathTraversalRisk = true;
        return result;
      }
    }

    // 检查必需文件
    const hasProfiles = entries.some(e =>
      e.startsWith('profiles/') && e.endsWith('.json')
    );

    if (!hasProfiles) {
      result.warnings.push(t('warn.backupNoProfiles'));
    }

    // 统计内容
    result.contents.hasSettings = entries.includes('settings.json');
    result.contents.hasState = entries.includes('csm-state.json');

    const profileEntries = entries.filter(e =>
      e.startsWith('profiles/') && e.endsWith('.json')
    );
    result.contents.profileCount = profileEntries.length;
    result.contents.profiles = profileEntries.map(e =>
      path.basename(e, '.json')
    );

    // 检查是否有实际内容
    if (!result.contents.hasSettings &&
      !result.contents.hasState &&
      result.contents.profileCount === 0) {
      result.valid = false;
      result.errors.push(t('error.backupNoContent'));
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(t('error.backupInvalidFormat', { error: error instanceof Error ? error.message : String(error) }));
  }

  return result;
}

/**
 * 读取 ZIP 文件条目列表
 */
async function readZipEntries(backupPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const entries: string[] = [];

    fs.createReadStream(backupPath)
      .pipe(unzipper.Parse())
      .on('entry', (entry: unzipper.Entry) => {
        entries.push(entry.path);
        entry.autodrain();
      })
      .on('close', () => resolve(entries))
      .on('error', reject);
  });
}
