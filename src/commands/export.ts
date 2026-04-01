import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { ProfileManager } from '../lib/profile';
import { success, error, info } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import { t } from '../i18n';

export function initExportCommand(program: Command) {
  program
    .command('export <name>')
    .description(t('cli.export.description'))
    .option('-o, --output <dir>', t('cli.export.optionOutput'))
    .option('-f, --filename <filename>', t('cli.export.optionFilename'))
    .action(async (name, options) => {
      try {
        // 1. 获取 profile settings
        const manager = new ProfileManager();
        const settings = await manager.get(name);

        // 2. 确定输出路径
        const outputDir = options.output
          ? (path.isAbsolute(options.output)
              ? options.output
              : path.resolve(process.cwd(), options.output))
          : process.cwd();

        // 确保输出目录存在
        await fs.ensureDir(outputDir);

        // 确定输出文件名
        const filename = options.filename || `${name}.json`;
        const outputPath = path.join(outputDir, filename);

        // 3. 写入 JSON 文件（格式化输出）
        await fs.writeJson(outputPath, settings, { spaces: 2 });
        success(t('success.configExported', { path: outputPath }));

      } catch (err) {
        handleCommandError(err, 'exportFailed');
      }
    });
}
