import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { ProfileManager } from '../lib/profile';
import { StateManager } from '../lib/state';
import { success, error, warn, info } from '../utils/logger';
import { getProfilesDir, getStatePath } from '../utils/file';
import { handleCommandError } from '../utils/errors';

export function initDeleteCommand(program: Command) {
  program
    .command('delete <name>')
    .description('删除指定配置档案')
    .option('-f, --force', '强制删除，不询问确认')
    .action(async (name, options) => {
      try {
        const profileManager = new ProfileManager();
        const stateManager = new StateManager();

        // 并行检查 profile 存在性和当前激活配置
        const [profile, activeProfile] = await Promise.all([
          profileManager.getIfExists(name),
          stateManager.getActiveProfile()
        ]);

        if (!profile) {
          error(`配置档案 "${name}" 不存在。`);
          process.exit(1);
        }

        // 如果是当前激活的 profile，警告
        const isActiveProfile = activeProfile === name;
        if (isActiveProfile) {
          warn(`配置档案 "${name}" 当前正在使用中。删除后当前设置将保持不变。`);
        }

        // 3. 如果无 --force，使用 inquirer 确认
        if (!options.force) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `确定要删除配置档案 "${name}" 吗？`,
              default: false
            }
          ]);

          if (!answer.confirm) {
            info('已取消删除操作。');
            return;
          }
        }

        // 4. 原子性删除：先更新状态，再删除文件
        // 如果状态更新失败，文件仍存在，用户可以重试
        // 如果文件删除失败，状态已清除，影响较小
        let stateBackup: string | null = null;
        const statePath = getStatePath();

        if (isActiveProfile) {
          // 备份状态文件以便回滚（直接尝试，失败说明文件不存在）
          try {
            stateBackup = `${statePath}.backup-${Date.now()}`;
            await fs.copy(statePath, stateBackup);
          } catch {
            // 文件不存在或复制失败，继续执行
          }

          // 先清除状态
          try {
            await stateManager.setActiveProfile(null);
          } catch (stateError) {
            // 状态更新失败，中止删除
            error(`更新状态失败，删除操作已中止: ${stateError instanceof Error ? stateError.message : String(stateError)}`);
            process.exit(1);
          }
        }

        // 5. 删除 profile 文件
        const deleted = await profileManager.delete(name);

        if (deleted) {
          // 删除成功，清理状态备份
          if (stateBackup) {
            try {
              await fs.remove(stateBackup);
            } catch {
              // 忽略清理错误
            }
          }
          success(`配置档案 "${name}" 已删除。`);
        } else {
          // 删除失败，尝试恢复状态
          if (stateBackup && await fs.pathExists(stateBackup)) {
            try {
              await fs.copy(stateBackup, statePath);
              await fs.remove(stateBackup);
              warn('删除失败，已恢复状态');
            } catch {
              error('删除失败且无法恢复状态，请手动检查');
            }
          }
          error(`删除配置档案 "${name}" 失败。`);
          process.exit(1);
        }
      } catch (err) {
        handleCommandError(err, '删除配置档案');
      }
    });
}