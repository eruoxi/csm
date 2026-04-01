import { Command } from 'commander';
import inquirer, { Answers } from 'inquirer';
import { ProfileManager } from '../lib/profile';
import { SettingsManager } from '../lib/settings';
import { success, error, info } from '../utils/logger';
import { validateProfileName } from '../utils/validator';
import { handleCommandError } from '../utils/errors';
import { ClaudeSettings } from '../types';
import { t } from '../i18n';

interface CreateAnswers extends Answers {
  configureBasic: boolean;
  language?: string;
  effortLevel?: string;
  autoMemoryEnabled?: boolean;
}

export function initCreateCommand(program: Command) {
  program
    .command('create <name>')
    .description(t('cli.create.description'))
    .option('-c, --copy-current', t('cli.create.optionCopyCurrent'))
    .option('-e, --empty', t('cli.create.optionEmpty'))
    .action(async (name, options) => {
      try {
        // 1. 验证名称格式
        if (!validateProfileName(name)) {
          error(t('error.profileNameInvalid'));
          process.exit(1);
        }

        const profileManager = new ProfileManager();
        const settingsManager = new SettingsManager();

        // 2. 检查是否已存在
        if (await profileManager.exists(name)) {
          error(t('error.profileAlreadyExists', { name }));
          info(t('info.useShowCommand', { name }));
          process.exit(1);
        }

        let settings: ClaudeSettings = {};

        // 3. 如果 --copy-current，读取当前 settings
        if (options.copyCurrent) {
          try {
            settings = await settingsManager.read();
            success(t('success.configCopied'));
          } catch (err) {
            error(t('error.cannotReadSettings'));
          }
        } else if (!options.empty && process.stdin.isTTY) {
          // 4. 在交互环境下使用 inquirer 创建基础配置
          const answers = await inquirer.prompt<CreateAnswers>([
            {
              type: 'confirm',
              name: 'configureBasic',
              message: t('prompt.configureBasic'),
              default: false
            },
            {
              type: 'input',
              name: 'language',
              message: t('prompt.setLanguage'),
              when: (ans) => ans.configureBasic
            },
            {
              type: 'list',
              name: 'effortLevel',
              message: t('prompt.selectEffort'),
              choices: [
                { name: t('prompt.effortLow'), value: 'low' },
                { name: t('prompt.effortMedium'), value: 'medium' },
                { name: t('prompt.effortHigh'), value: 'high' },
                { name: t('prompt.skipSetting'), value: '' }
              ],
              when: (ans) => ans.configureBasic
            },
            {
              type: 'confirm',
              name: 'autoMemoryEnabled',
              message: t('prompt.enableAutoMemory'),
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
        success(t('success.profileCreated', { name }));
      } catch (err) {
        handleCommandError(err, 'createFailed');
      }
    });
}
