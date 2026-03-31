import { Command } from 'commander';
import { ProfileManager } from '../lib/profile';
import { success, error } from '../utils/logger';
import { validateProfileName } from '../utils/validator';
import { handleCommandError } from '../utils/errors';

export function initCopyCommand(program: Command) {
  program
    .command('copy <src> <dest>')
    .description('复制现有配置创建新配置')
    .action(async (src, dest) => {
      try {
        // 验证目标名称格式
        if (!validateProfileName(dest)) {
          error(`配置名称无效: "${dest}"。名称只能包含字母、数字、连字符和下划线`);
          process.exit(1);
        }

        const manager = new ProfileManager();

        // 1. 检查源 profile 存在
        const sourceSettings = await manager.get(src);

        // 2. 检查目标名称不存在
        if (await manager.exists(dest)) {
          error(`目标配置 "${dest}" 已存在`);
          process.exit(1);
        }

        // 3. 复制 settings
        await manager.create(dest, sourceSettings);

        success(`成功复制配置: ${src} -> ${dest}`);

      } catch (err) {
        handleCommandError(err, '复制');
      }
    });
}
