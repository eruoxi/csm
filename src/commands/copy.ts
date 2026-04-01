import { Command } from 'commander';
import { ProfileManager } from '../lib/profile';
import { success, error } from '../utils/logger';
import { validateProfileName } from '../utils/validator';
import { handleCommandError } from '../utils/errors';
import { t } from '../i18n';

export function initCopyCommand(program: Command) {
  program
    .command('copy <src> <dest>')
    .description(t('cli.copy.description'))
    .action(async (src, dest) => {
      try {
        // 验证目标名称格式
        if (!validateProfileName(dest)) {
          error(t('error.profileNameInvalidWithReason', { name: dest, reason: t('validation.nameInvalidChars') }));
          process.exit(1);
        }

        const manager = new ProfileManager();

        // 1. 检查源 profile 存在
        const sourceSettings = await manager.get(src);

        // 2. 检查目标名称不存在
        if (await manager.exists(dest)) {
          error(t('error.destProfileExists', { name: dest }));
          process.exit(1);
        }

        // 3. 复制 settings
        await manager.create(dest, sourceSettings);

        success(t('success.profileCopied', { src, dest }));

      } catch (err) {
        handleCommandError(err, 'copyFailed');
      }
    });
}
