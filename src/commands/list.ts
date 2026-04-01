import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileManager } from '../lib/profile';
import { stateManager } from '../lib/state';
import { info } from '../utils/logger';
import { t } from '../i18n';

export function initListCommand(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description(t('cli.list.description'))
    .option('-j, --json', t('cli.backups.optionJson'))
    .action(async (options) => {
      try {
        const profileManager = new ProfileManager();

        // 1. 获取所有 profiles
        const profiles = await profileManager.list();

        // 2. 获取当前激活的 profile
        const activeProfile = await stateManager.getActiveProfile();

        if (options.json) {
          // JSON 格式输出
          const output = {
            profiles: profiles.map(name => ({
              name,
              active: name === activeProfile
            })),
            activeProfile
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          // 格式化输出
          if (profiles.length === 0) {
            info(t('info.noProfilesYet'));
            return;
          }

          console.log();
          console.log(chalk.bold(t('table.profileList')));
          console.log();

          for (const name of profiles) {
            const isActive = name === activeProfile;
            const prefix = isActive ? chalk.green('*') : ' ';
            const displayName = isActive ? chalk.green.bold(name) : name;

            console.log(`  ${prefix} ${displayName}`);
          }

          console.log();

          if (activeProfile) {
            console.log(chalk.gray(t('info.activeProfile', { name: activeProfile })));
          } else {
            console.log(chalk.gray(t('info.noActiveProfileLabel')));
          }
        }
      } catch (err) {
        console.error(chalk.red(t('command.listFailed', { error: err instanceof Error ? err.message : String(err) })));
        process.exit(1);
      }
    });
}
