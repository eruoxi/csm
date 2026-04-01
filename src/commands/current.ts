import { Command } from 'commander';
import { stateManager } from '../lib/state';
import { ProfileManager } from '../lib/profile';
import { info, warn, error } from '../utils/logger';
import { highlightJson } from '../utils/logger';
import { t } from '../i18n';

export function initCurrentCommand(program: Command) {
  program
    .command('current')
    .description(t('cli.current.description'))
    .option('-s, --show-settings', t('cli.current.optionShowSettings'))
    .action(async (options) => {
      try {
        const profileManager = new ProfileManager();

        // 1. 获取 activeProfile 名称
        const activeProfile = await stateManager.getActiveProfile();

        // 2. 如果 null，显示无激活配置
        if (!activeProfile) {
          warn(t('info.noActiveProfile'));
          info(t('info.useUseCommand'));
          return;
        }

        // 3. 显示当前激活的配置名称
        info(t('info.currentProfile', { name: activeProfile }));

        // 4. 如果 --show-settings，获取 profile 详情显示
        if (options.showSettings) {
          const settings = await profileManager.getIfExists(activeProfile);

          if (!settings) {
            error(t('error.profileCorrupted', { name: activeProfile }));
            return;
          }

          // 显示 settings 内容
          console.log(`\n${t('info.profileContent')}`);
          console.log(highlightJson(settings));
        }

      } catch (err) {
        error(t('error.getCurrentFailed', { error: err instanceof Error ? err.message : String(err) }));
        process.exit(1);
      }
    });
}
