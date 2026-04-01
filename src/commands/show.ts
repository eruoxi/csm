import { Command } from 'commander';
import { ProfileManager } from '../lib/profile';
import { highlightJson, error, info } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import { t } from '../i18n';

export function initShowCommand(program: Command) {
  program
    .command('show <name>')
    .description(t('cli.show.description'))
    .action(async (name) => {
      try {
        const profileManager = new ProfileManager();

        // 1. 获取 profile settings
        const settings = await profileManager.get(name);

        // 2. 使用 highlightJson 显示内容
        console.log(highlightJson(settings));
      } catch (err) {
        handleCommandError(err, 'showFailed');
      }
    });
}
