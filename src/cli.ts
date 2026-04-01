#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { initI18n, setLanguage } from './i18n';
import { stateManager } from './lib/state';

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

// 语言优先级: 命令行 --lang > 持久化设置 > 环境变量 > 系统检测
const langArgIndex = process.argv.findIndex(arg => arg === '--lang');
if (langArgIndex !== -1 && process.argv[langArgIndex + 1]) {
  setLanguage(process.argv[langArgIndex + 1]);
} else {
  const savedLang = stateManager.getLanguageSync();
  initI18n(savedLang);
}

import { initCreateCommand } from './commands/create';
import { initShowCommand } from './commands/show';
import { initEditCommand } from './commands/edit';
import { initDeleteCommand } from './commands/delete';
import { initListCommand } from './commands/list';
import { initUseCommand } from './commands/use';
import { initCurrentCommand } from './commands/current';
import { initImportCommand } from './commands/import';
import { initExportCommand } from './commands/export';
import { initCopyCommand } from './commands/copy';
import { initRenameCommand } from './commands/rename';
import { initBackupCommand } from './commands/backup';
import { initRestoreCommand } from './commands/restore';
import { initBackupsCommand } from './commands/backups';
import { initLangCommand } from './commands/lang';

const program = new Command();

program
  .name('csm')
  .description(packageJson.description)
  .version(packageJson.version);

initCreateCommand(program);
initShowCommand(program);
initEditCommand(program);
initDeleteCommand(program);
initListCommand(program);
initUseCommand(program);
initCurrentCommand(program);
initImportCommand(program);
initExportCommand(program);
initCopyCommand(program);
initRenameCommand(program);
initBackupCommand(program);
initRestoreCommand(program);
initBackupsCommand(program);
initLangCommand(program);

program.parse();