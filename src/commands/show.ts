import { Command } from 'commander';
import { ProfileManager } from '../lib/profile';
import { highlightJson, error, info } from '../utils/logger';
import { handleCommandError } from '../utils/errors';

export function initShowCommand(program: Command) {
  program
    .command('show <name>')
    .description('显示指定配置的详细内容')
    .action(async (name) => {
      try {
        const profileManager = new ProfileManager();

        // 1. 获取 profile settings
        const settings = await profileManager.get(name);

        // 2. 使用 highlightJson 显示内容
        console.log(highlightJson(settings));
      } catch (err) {
        handleCommandError(err, '显示配置档案');
      }
    });
}
