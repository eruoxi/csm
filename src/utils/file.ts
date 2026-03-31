/**
 * 文件操作辅助函数
 */
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Claude Code 配置目录名
const CLAUDE_DIR_NAME = '.claude';
// CSM 数据子目录名
const CSM_DIR_NAME = 'csm';

// 获取 Claude 配置目录
export function getClaudeDir(): string {
  return path.join(os.homedir(), CLAUDE_DIR_NAME);
}

// 获取 CSM 数据目录 (~/.claude/csm)
export function getCsmDir(): string {
  return path.join(getClaudeDir(), CSM_DIR_NAME);
}

// 获取 Profiles 目录 (~/.claude/csm/profiles)
export function getProfilesDir(): string {
  return path.join(getCsmDir(), 'profiles');
}

// 获取 Settings 文件路径 (保持在 ~/.claude/settings.json)
export function getSettingsPath(): string {
  return path.join(getClaudeDir(), 'settings.json');
}

// 获取 Backups 目录 (~/.claude/csm/backups)
export function getBackupsDir(): string {
  return path.join(getCsmDir(), 'backups');
}

// 获取 State 文件路径 (~/.claude/csm/csm-state.json)
export function getStatePath(): string {
  return path.join(getCsmDir(), 'csm-state.json');
}

// 确保 Claude 相关目录存在
export async function ensureClaudeDirs(): Promise<void> {
  await fs.ensureDir(getClaudeDir());
  await fs.ensureDir(getCsmDir());
  await fs.ensureDir(getProfilesDir());
  await fs.ensureDir(getBackupsDir());
}