import { Command } from 'commander';
import inquirer, { Answers } from 'inquirer';
import { ProfileManager } from '../lib/profile';
import { SettingsManager } from '../lib/settings';
import { success, error, info } from '../utils/logger';
import { validateProfileName } from '../utils/validator';
import { handleCommandError } from '../utils/errors';
import { ClaudeSettings } from '../types';

interface CreateAnswers extends Answers {
  configureBasic: boolean;
  language?: string;
  effortLevel?: string;
  autoMemoryEnabled?: boolean;
}

export function initCreateCommand(program: Command) {
  program
    .command('create <name>')
    .description('创建新的配置档案')
    .option('-c, --copy-current', '从当前 settings.json 复制配置')
    .option('-e, --empty', '创建空配置，跳过交互式设置')
    .action(async (name, options) => {
      try {
        // 1. 验证名称格式
        if (!validateProfileName(name)) {
          error('名称格式无效。只允许使用字母、数字、连字符和下划线。');
          process.exit(1);
        }

        const profileManager = new ProfileManager();
        const settingsManager = new SettingsManager();

        // 2. 检查是否已存在
        if (await profileManager.exists(name)) {
          error(`配置档案 "${name}" 已存在。`);
          info(`提示: 使用 "csm show ${name}" 查看该配置`);
          process.exit(1);
        }

        let settings: ClaudeSettings = {};

        // 3. 如果 --copy-current，读取当前 settings
        if (options.copyCurrent) {
          try {
            settings = await settingsManager.read();
            success('已从当前 settings.json 复制配置。');
          } catch (err) {
            error('无法读取当前 settings.json，将创建空配置。');
          }
        } else if (!options.empty && process.stdin.isTTY) {
          // 4. 在交互环境下使用 inquirer 创建基础配置
          const answers = await inquirer.prompt<CreateAnswers>([
            {
              type: 'confirm',
              name: 'configureBasic',
              message: '是否配置基础设置？',
              default: false
            },
            {
              type: 'input',
              name: 'language',
              message: '设置语言 (留空跳过):',
              when: (ans) => ans.configureBasic
            },
            {
              type: 'list',
              name: 'effortLevel',
              message: '选择努力级别:',
              choices: [
                { name: 'low - 快速响应，适合简单任务', value: 'low' },
                { name: 'medium - 平衡模式 (默认)', value: 'medium' },
                { name: 'high - 深度思考，适合复杂任务', value: 'high' },
                { name: '跳过此设置', value: '' }
              ],
              when: (ans) => ans.configureBasic
            },
            {
              type: 'confirm',
              name: 'autoMemoryEnabled',
              message: '启用自动记忆？',
              default: false,
              when: (ans) => ans.configureBasic
            }
          ]);

          if (answers.configureBasic) {
            if (answers.language) {
              settings.language = answers.language;
            }
            if (answers.effortLevel) {
              settings.effortLevel = answers.effortLevel;
            }
            if (answers.autoMemoryEnabled !== undefined) {
              settings.autoMemoryEnabled = answers.autoMemoryEnabled;
            }
          }
        }
        // 5. --empty 或非交互环境时创建空配置

        // 6. 创建 profile 文件
        await profileManager.create(name, settings);
        success(`配置档案 "${name}" 创建成功。`);
      } catch (err) {
        handleCommandError(err, '创建配置档案');
      }
    });
}
