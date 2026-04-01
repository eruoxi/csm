import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { ProfileManager } from '../lib/profile';
import { success, error, warn, info } from '../utils/logger';
import { validateSettings, validateProfileName } from '../utils/validator';
import { handleCommandError } from '../utils/errors';
import { ClaudeSettings } from '../types';
import { t } from '../i18n';

export function initImportCommand(program: Command) {
  program
    .command('import <file>')
    .description(t('cli.import.description'))
    .option('-n, --name <name>', t('cli.import.optionName'))
    .option('-f, --force', t('cli.import.optionForce'))
    .action(async (file, options) => {
      try {
        // 1. 解析文件路径（支持相对路径和绝对路径）
        const filePath = path.isAbsolute(file)
          ? file
          : path.resolve(process.cwd(), file);

        // 2. 检查文件存在
        if (!(await fs.pathExists(filePath))) {
          error(t('error.fileNotFound', { path: filePath }));
          process.exit(1);
        }

        // 3. 读取并解析 JSON
        let content: unknown;
        try {
          content = await fs.readJson(filePath);
        } catch (e) {
          error(t('error.fileParseError'));
          process.exit(1);
        }

        // 4. 验证格式 - 只支持 Settings 格式
        if (!validateSettings(content as ClaudeSettings)) {
          error(t('error.invalidSettingsFormat'));
          process.exit(1);
        }

        const settings = content as ClaudeSettings;

        // 5. 确定名称（优先使用 --name，其次使用文件名）
        const finalName = options.name || path.basename(filePath, '.json');

        // 6. 验证名称格式
        if (!validateProfileName(finalName)) {
          error(t('error.profileNameInvalidWithReason', { name: finalName, reason: t('validation.nameInvalidChars') }));
          process.exit(1);
        }

        // 7. 检查是否已存在
        const manager = new ProfileManager();
        if (await manager.exists(finalName)) {
          if (options.force) {
            // 删除已存在的配置
            await manager.delete(finalName);
            warn(t('success.profileDeleted', { name: finalName }));
          } else {
            error(t('error.destProfileExists', { name: finalName }));
            info(t('info.forceDeleteHint'));
            process.exit(1);
          }
        }

        // 8. 创建 profile
        await manager.create(finalName, settings);
        success(t('success.configImported', { name: finalName }));

      } catch (err) {
        handleCommandError(err, 'importFailed');
      }
    });
}
