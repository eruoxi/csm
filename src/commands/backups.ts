import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { getBackupsDir } from '../utils/file';
import { success, info, warn } from '../utils/logger';
import { BackupInfo } from '../types';

/**
 * 获取备份文件列表
 */
async function getBackupList(): Promise<BackupInfo[]> {
  const backupsDir = getBackupsDir();

  if (!(await fs.pathExists(backupsDir))) {
    return [];
  }

  const files = await fs.readdir(backupsDir);
  const backupFiles = files.filter(f => f.endsWith('.zip'));

  const backups: BackupInfo[] = [];

  for (const file of backupFiles) {
    const filePath = path.join(backupsDir, file);
    const stats = await fs.stat(filePath);
    backups.push({
      name: file,
      path: filePath,
      createdAt: stats.birthtime.toISOString(),
      size: stats.size
    });
  }

  // 按创建时间降序排序
  return backups.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * 格式化日期时间
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function initBackupsCommand(program: Command) {
  program
    .command('backups')
    .description('列出所有备份文件')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        const backups = await getBackupList();

        if (backups.length === 0) {
          warn('没有找到任何备份文件');
          info(`备份目录: ${getBackupsDir()}`);
          return;
        }

        if (options.json) {
          // JSON 格式输出
          console.log(JSON.stringify(backups, null, 2));
        } else {
          // 表格格式输出
          success(`找到 ${backups.length} 个备份文件:\n`);

          // 计算列宽
          const nameWidth = Math.max(35, ...backups.map(b => b.name.length));
          const dateWidth = 20;
          const sizeWidth = 12;

          // 表头
          const header =
            '名称'.padEnd(nameWidth) +
            '创建时间'.padEnd(dateWidth) +
            '大小'.padEnd(sizeWidth);
          console.log(header);
          console.log('-'.repeat(nameWidth + dateWidth + sizeWidth));

          // 数据行
          for (const backup of backups) {
            const line =
              backup.name.padEnd(nameWidth) +
              formatDateTime(backup.createdAt).padEnd(dateWidth) +
              formatSize(backup.size).padEnd(sizeWidth);
            console.log(line);
          }

          console.log('');
          info(`备份目录: ${getBackupsDir()}`);
        }
      } catch (err) {
        console.error(`列出备份失败: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}