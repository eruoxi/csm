import { Command } from 'commander';
import { ProfileManager } from '../lib/profile';
import { StateManager } from '../lib/state';
import { success } from '../utils/logger';
import { handleCommandError } from '../utils/errors';

export function initRenameCommand(program: Command) {
  program
    .command('rename <oldName> <newName>')
    .description('重命名配置档案')
    .action(async (oldName, newName) => {
      try {
        const profileManager = new ProfileManager();
        const stateManager = new StateManager();

        // 执行重命名（rename 方法会检查源存在和目标不存在）
        await profileManager.rename(oldName, newName);

        // 如果是当前激活的配置，更新状态
        const activeProfile = await stateManager.getActiveProfile();
        if (activeProfile === oldName) {
          await stateManager.setActiveProfile(newName);
        }

        success(`配置档案已重命名: ${oldName} -> ${newName}`);
      } catch (err) {
        handleCommandError(err, '重命名');
      }
    });
}
