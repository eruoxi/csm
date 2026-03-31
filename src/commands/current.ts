import { Command } from 'commander';
import { StateManager } from '../lib/state';
import { ProfileManager } from '../lib/profile';
import { info, warn, error } from '../utils/logger';
import { highlightJson } from '../utils/logger';

export function initCurrentCommand(program: Command) {
  program
    .command('current')
    .description('显示当前激活的配置名称')
    .option('-s, --show-settings', '同时显示当前 settings 内容')
    .action(async (options) => {
      try {
        const stateManager = new StateManager();
        const profileManager = new ProfileManager();

        // 1. 获取 activeProfile 名称
        const activeProfile = await stateManager.getActiveProfile();

        // 2. 如果 null，显示无激活配置
        if (!activeProfile) {
          warn('当前没有激活的配置');
          info('使用 "csm use <name>" 或 "csm switch" 切换到一个配置');
          return;
        }

        // 3. 显示当前激活的配置名称
        info(`当前配置: ${activeProfile}`);

        // 4. 如果 --show-settings，获取 profile 详情显示
        if (options.showSettings) {
          const settings = await profileManager.getIfExists(activeProfile);

          if (!settings) {
            error(`配置 "${activeProfile}" 的文件不存在或已损坏`);
            return;
          }

          // 显示 settings 内容
          console.log('\n配置内容:');
          console.log(highlightJson(settings));
        }

      } catch (err) {
        error(`获取当前配置失败: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
