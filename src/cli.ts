#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

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

const program = new Command();

program
  .name('csm')
  .description(packageJson.description)
  .version(packageJson.version);

// 注册所有命令
initCreateCommand(program);
initShowCommand(program);
initEditCommand(program);
initDeleteCommand(program);
initListCommand(program);
initUseCommand(program);  // 包含 switch 别名
initCurrentCommand(program);
initImportCommand(program);
initExportCommand(program);
initCopyCommand(program);
initRenameCommand(program);
initBackupCommand(program);
initRestoreCommand(program);
initBackupsCommand(program);

program.parse();