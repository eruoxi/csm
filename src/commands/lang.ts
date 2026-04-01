/**
 * 语言设置命令
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { stateManager } from '../lib/state';
import { setLanguage, isValidLanguage, SUPPORTED_LANGUAGES, getLanguage, t, LANGUAGE_OPTIONS } from '../i18n';
import { success, error } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import type { SupportedLanguage } from '../types';

async function applyLanguageSetting(lang: SupportedLanguage): Promise<void> {
  await stateManager.setLanguage(lang);
  setLanguage(lang);
  success(t('success.languageSet', { lang }));
}

export function initLangCommand(program: Command) {
  program
    .command('lang [language]')
    .alias('language')
    .description(t('cli.lang.description'))
    .action(async (language?: string) => {
      try {
        if (language) {
          if (!isValidLanguage(language)) {
            error(t('error.invalidLanguage', { langs: SUPPORTED_LANGUAGES.join(', ') }));
            process.exit(1);
          }
          await applyLanguageSetting(language);
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'list',
              name: 'language',
              message: t('prompt.selectLanguage'),
              choices: LANGUAGE_OPTIONS,
              default: getLanguage()
            }
          ]);
          await applyLanguageSetting(answers.language);
        }
      } catch (err) {
        handleCommandError(err, 'langFailed');
      }
    });
}
