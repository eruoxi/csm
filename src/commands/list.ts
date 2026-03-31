import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileManager } from '../lib/profile';
import { StateManager } from '../lib/state';
import { info } from '../utils/logger';

export function initListCommand(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('列出所有配置档案')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        const profileManager = new ProfileManager();
        const stateManager = new StateManager();

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
            info('暂无配置档案。使用 csm create <name> 创建新配置。');
            return;
          }

          console.log();
          console.log(chalk.bold('配置档案列表:'));
          console.log();

          for (const name of profiles) {
            const isActive = name === activeProfile;
            const prefix = isActive ? chalk.green('*') : ' ';
            const displayName = isActive ? chalk.green.bold(name) : name;

            console.log(`  ${prefix} ${displayName}`);
          }

          console.log();

          if (activeProfile) {
            console.log(chalk.gray(`当前激活: ${activeProfile}`));
          } else {
            console.log(chalk.gray('当前无激活的配置档案'));
          }
        }
      } catch (err) {
        console.error(chalk.red(`列出配置档案失败: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
