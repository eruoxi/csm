import { Command } from 'commander';
import { spawn } from 'child_process';
import { ProfileManager } from '../lib/profile';
import { getProfilesDir } from '../utils/file';
import { error, info, success } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import path from 'path';

/**
 * 获取可用的编辑器命令
 */
function getEditorCommand(): string | null {
  // 优先使用环境变量
  if (process.env.EDITOR) return process.env.EDITOR;
  if (process.env.VISUAL) return process.env.VISUAL;

  // 根据平台选择默认编辑器
  if (process.platform === 'win32') {
    return 'notepad';
  }

  // macOS/Linux 返回最常见编辑器
  return 'nano';
}

/**
 * 尝试打开编辑器
 * @returns 是否成功打开编辑器
 */
function openEditor(filePath: string): boolean {
  const editor = getEditorCommand();

  if (!editor) {
    return false;
  }

  try {
    // 在后台打开编辑器
    const child = spawn(editor, [filePath], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32'
    });

    // 让子进程独立运行
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function initEditCommand(program: Command) {
  program
    .command('edit <name>')
    .description('编辑配置档案')
    .option('--no-open', '仅显示文件路径，不打开编辑器')
    .action(async (name, options) => {
      try {
        const profileManager = new ProfileManager();

        // 1. 检查 profile 存在
        const exists = await profileManager.exists(name);

        if (!exists) {
          error(`配置档案 "${name}" 不存在。`);
          info(`提示: 使用 "csm list" 查看所有可用配置`);
          process.exit(1);
        }

        const filePath = path.join(getProfilesDir(), `${name}.json`);

        // 2. 尝试打开编辑器
        if (options.open !== false) {
          const opened = openEditor(filePath);
          if (opened) {
            success(`已打开编辑器: ${filePath}`);
            return;
          }
        }

        // 3. 无法打开编辑器或用户指定不打开
        info(`请使用外部编辑器编辑配置文件。`);
        info(`配置文件路径: ${filePath}`);
      } catch (err) {
        handleCommandError(err, '编辑配置档案');
      }
    });
}
