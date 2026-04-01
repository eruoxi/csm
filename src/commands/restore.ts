import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import unzipper from 'unzipper';
import inquirer from 'inquirer';
import { getBackupsDir, getProfilesDir, getSettingsPath, getStatePath, getCsmDir } from '../utils/file';
import { success, error, warn, info } from '../utils/logger';
import { validateBackup, isEntryPathSafe } from '../utils/backupValidator';
import { SettingsManager } from '../lib/settings';
import { handleCommandError } from '../utils/errors';
import { t } from '../i18n';

/**
 * 创建恢复前的自动备份（仅备份当前 settings.json）
 * @returns 备份文件路径，如果 settings 不存在则返回 null
 */
async function createPreRestoreSettingsBackup(): Promise<string | null> {
  const settingsPath = getSettingsPath();

  if (!(await fs.pathExists(settingsPath))) {
    return null;
  }

  const settingsManager = new SettingsManager();

  try {
    return await settingsManager.backup();
  } catch {
    return null;
  }
}

/**
 * 解析备份文件路径
 * 支持名称或完整路径
 */
async function resolveBackupPath(backup: string): Promise<string> {
  // 如果是绝对路径且存在，直接返回
  if (path.isAbsolute(backup) && await fs.pathExists(backup)) {
    return backup;
  }

  // 如果是相对路径且存在，返回完整路径
  const cwdPath = path.resolve(process.cwd(), backup);
  if (await fs.pathExists(cwdPath)) {
    return cwdPath;
  }

  // 在备份目录中查找
  const backupsDir = getBackupsDir();
  const backupPath = path.join(backupsDir, backup.endsWith('.zip') ? backup : `${backup}.zip`);
  if (await fs.pathExists(backupPath)) {
    return backupPath;
  }

  throw new Error(t('error.backupNotFound', { name: backup }));
}

/**
 * 安全解压备份文件
 * 手动处理每个条目，确保路径安全
 */
async function safeExtractBackup(backupPath: string): Promise<void> {
  const csmDir = getCsmDir();

  return new Promise((resolve, reject) => {
    fs.createReadStream(backupPath)
      .pipe(unzipper.Parse())
      .on('entry', async (entry: unzipper.Entry) => {
        const entryPath = entry.path;

        // 使用统一的路径安全检查
        if (!isEntryPathSafe(entryPath)) {
          entry.autodrain();
          return;
        }

        const destPath = path.join(csmDir, entryPath);

        // 确保目标目录存在
        await fs.ensureDir(path.dirname(destPath));

        // 写入文件
        entry.pipe(fs.createWriteStream(destPath));
      })
      .on('close', resolve)
      .on('error', reject);
  });
}

export function initRestoreCommand(program: Command) {
  program
    .command('restore <backup>')
    .description(t('cli.restore.description'))
    .option('-f, --force', t('cli.restore.optionForce'))
    .option('--skip-validation', t('cli.restore.optionSkipValidation'))
    .option('--no-auto-backup', t('cli.restore.optionNoAutoBackup'))
    .action(async (backup, options) => {
      try {
        // 1. 定位备份文件
        const backupPath = await resolveBackupPath(backup);
        info(t('info.backupFound', { path: backupPath }));

        // 2. 验证备份文件
        if (!options.skipValidation) {
          info(t('info.backupValidating'));
          const validation = await validateBackup(backupPath);

          if (!validation.valid) {
            error(t('error.backupValidationFailed'));
            for (const err of validation.errors) {
              error(`  - ${err}`);
            }
            process.exit(1);
            return;
          }

          if (validation.warnings.length > 0) {
            for (const warning of validation.warnings) {
              warn(warning);
            }
          }

          // 显示备份内容预览
          info(t('info.backupContent'));
          if (validation.contents.hasSettings) {
            info(`  - ${t('info.backupSettings')}`);
          }
          if (validation.contents.hasState) {
            info(`  - ${t('info.backupState')}`);
          }
          if (validation.contents.profileCount > 0) {
            info(`  - ${t('info.backupProfiles', { count: validation.contents.profileCount })}`);
          }
        }

        // 3. 检查现有配置（并行检查）
        const settingsPath = getSettingsPath();
        const statePath = getStatePath();
        const profilesDir = getProfilesDir();

        const [hasSettings, hasState, hasProfiles] = await Promise.all([
          fs.pathExists(settingsPath),
          fs.pathExists(statePath),
          fs.pathExists(profilesDir)
        ]);
        const hasExistingConfig = hasSettings || hasState || hasProfiles;

        // 4. 自动备份当前配置
        let autoBackupPath: string | null = null;
        if (hasExistingConfig && options.autoBackup !== false) {
          info(t('info.backupCurrent'));
          autoBackupPath = await createPreRestoreSettingsBackup();
          if (autoBackupPath) {
            info(t('info.backupCurrentDone', { path: autoBackupPath }));
          }
        }

        // 5. 确认覆盖
        if (hasExistingConfig && !options.force) {
          const answers = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: t('prompt.confirmOverwrite'),
              default: false
            }
          ]);

          if (!answers.confirm) {
            warn(t('warn.operationCancelled'));
            return;
          }
        }

        // 6. 解压到相应位置
        info(t('info.backupRestoring'));
        await safeExtractBackup(backupPath);

        // 7. 输出恢复结果
        success(t('success.configRestored'));
        info(t('info.restoredContent'));
        if (await fs.pathExists(settingsPath)) {
          info(`  - ${t('info.backupSettings')}`);
        }
        if (await fs.pathExists(statePath)) {
          info(`  - ${t('info.backupState')}`);
        }
        if (await fs.pathExists(profilesDir)) {
          const profiles = (await fs.readdir(profilesDir)).filter(f => f.endsWith('.json'));
          if (profiles.length > 0) {
            info(`  - ${t('info.backupProfileFiles', { count: profiles.length })}`);
          }
        }

        // 提示自动备份位置
        if (autoBackupPath) {
          info(t('info.useRestoreCommand', { name: path.basename(autoBackupPath) }));
        }
      } catch (err) {
        handleCommandError(err, 'restoreFailed');
      }
    });
}