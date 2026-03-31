import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { getBackupsDir, getProfilesDir, getSettingsPath, getStatePath } from '../utils/file';
import { success, error, info } from '../utils/logger';
import { handleCommandError } from '../utils/errors';

/**
 * 生成备份文件名
 * 格式: csm-backup-YYYYMMDD-HHmmss.zip
 */
function generateBackupName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `csm-backup-${year}${month}${day}-${hours}${minutes}${seconds}.zip`;
}

/**
 * 创建 zip 压缩包
 */
async function createZipArchive(
  outputPath: string,
  profilesDir: string,
  settingsPath: string,
  statePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // 添加 profiles 目录
    (async () => {
      if (await fs.pathExists(profilesDir)) {
        const files = await fs.readdir(profilesDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(profilesDir, file);
            archive.file(filePath, { name: `profiles/${file}` });
          }
        }
      }

      // 添加 settings.json
      if (await fs.pathExists(settingsPath)) {
        archive.file(settingsPath, { name: 'settings.json' });
      }

      // 添加 csm-state.json
      if (await fs.pathExists(statePath)) {
        archive.file(statePath, { name: 'csm-state.json' });
      }

      archive.finalize();
    })().catch(reject);
  });
}

export function initBackupCommand(program: Command) {
  program
    .command('backup')
    .description('备份所有配置到压缩包')
    .option('-n, --name <name>', '备份文件名，默认自动生成')
    .action(async (options) => {
      try {
        // 1. 确保备份目录存在
        const backupsDir = getBackupsDir();
        await fs.ensureDir(backupsDir);

        // 2. 确定备份文件名和路径
        const backupName = options.name || generateBackupName();
        const backupPath = path.join(backupsDir, backupName.endsWith('.zip') ? backupName : `${backupName}.zip`);

        // 3. 获取需要备份的路径
        const profilesDir = getProfilesDir();
        const settingsPath = getSettingsPath();
        const statePath = getStatePath();

        // 4. 检查是否有内容需要备份
        const profilesExist = await fs.pathExists(profilesDir);
        const settingsExist = await fs.pathExists(settingsPath);
        const stateExist = await fs.pathExists(statePath);

        if (!profilesExist && !settingsExist && !stateExist) {
          error('没有找到任何配置文件，无法创建备份');
          return;
        }

        // 5. 创建压缩包
        info('正在创建备份...');
        await createZipArchive(backupPath, profilesDir, settingsPath, statePath);

        // 6. 输出结果
        const stats = await fs.stat(backupPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        success(`备份已创建: ${backupPath}`);
        info(`文件大小: ${sizeKB} KB`);
      } catch (err) {
        handleCommandError(err, '备份');
      }
    });
}