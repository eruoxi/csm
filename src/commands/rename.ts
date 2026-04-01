import { Command } from 'commander';
import { ProfileManager } from '../lib/profile';
import { stateManager } from '../lib/state';
import { success } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import { t } from '../i18n';

export function initRenameCommand(program: Command) {
  program
    .command('rename <oldName> <newName>')
    .description(t('cli.rename.description'))
    .action(async (oldName, newName) => {
      try {
        const profileManager = new ProfileManager();

        // 执行重命名（rename 方法会检查源存在和目标不存在）
        await profileManager.rename(oldName, newName);

        // 如果是当前激活的配置，更新状态
        const activeProfile = await stateManager.getActiveProfile();
        if (activeProfile === oldName) {
          await stateManager.setActiveProfile(newName);
        }

        success(t('success.profileRenamed', { oldName, newName }));
      } catch (err) {
        handleCommandError(err, 'renameFailed');
      }
    });
}
