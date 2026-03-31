import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { ProfileManager } from '../lib/profile';
import { success, error, warn } from '../utils/logger';
import { validateSettings, validateProfileName } from '../utils/validator';
import { handleCommandError } from '../utils/errors';
import { ClaudeSettings } from '../types';

export function initImportCommand(program: Command) {
  program
    .command('import <file>')
    .description('从外部 JSON 文件导入配置')
    .option('-n, --name <name>', '指定导入后的配置名称')
    .option('-f, --force', '覆盖已存在的同名配置')
    .action(async (file, options) => {
      try {
        // 1. 解析文件路径（支持相对路径和绝对路径）
        const filePath = path.isAbsolute(file)
          ? file
          : path.resolve(process.cwd(), file);

        // 2. 检查文件存在
        if (!(await fs.pathExists(filePath))) {
          error(`文件不存在: ${filePath}`);
          process.exit(1);
        }

        // 3. 读取并解析 JSON
        let content: unknown;
        try {
          content = await fs.readJson(filePath);
        } catch (e) {
          error('无法解析 JSON 文件，请检查文件格式');
          process.exit(1);
        }

        // 4. 验证格式 - 只支持 Settings 格式
        if (!validateSettings(content as ClaudeSettings)) {
          error('文件格式无效，必须是有效的 Settings JSON 格式');
          process.exit(1);
        }

        const settings = content as ClaudeSettings;

        // 5. 确定名称（优先使用 --name，其次使用文件名）
        const finalName = options.name || path.basename(filePath, '.json');

        // 6. 验证名称格式
        if (!validateProfileName(finalName)) {
          error(`配置名称无效: "${finalName}"。名称只能包含字母、数字、连字符和下划线`);
          process.exit(1);
        }

        // 7. 检查是否已存在
        const manager = new ProfileManager();
        if (await manager.exists(finalName)) {
          if (options.force) {
            // 删除已存在的配置
            await manager.delete(finalName);
            warn(`已删除现有配置: ${finalName}`);
          } else {
            error(`配置 "${finalName}" 已存在。使用 -f 或 --force 选项覆盖`);
            process.exit(1);
          }
        }

        // 8. 创建 profile
        await manager.create(finalName, settings);
        success(`成功导入配置: ${finalName}`);

      } catch (err) {
        handleCommandError(err, '导入');
      }
    });
}
