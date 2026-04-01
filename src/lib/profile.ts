import fs from 'fs-extra';
import path from 'path';
import { getCsmDir, getProfilesDir } from '../utils/file';
import type { ClaudeSettings } from '../types';
import { validateProfileName } from '../utils/validator';
import { CsmError, CsmErrorCode } from '../utils/errors';
import { t } from '../i18n';

/**
 * Profile Manager - Manage Claude Code configuration profiles
 */
export class ProfileManager {
  private baseDir: string;
  private profilesDir: string;

  /**
   * Create a ProfileManager instance
   * @param customDir - Optional custom base directory (for testing)
   */
  constructor(customDir?: string) {
    // Use customDir for testing, otherwise use default ~/.claude/csm
    this.baseDir = customDir || getCsmDir();
    this.profilesDir = customDir
      ? path.join(customDir, 'profiles')
      : getProfilesDir();
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirs(): Promise<void> {
    await fs.ensureDir(this.profilesDir);
  }

  /**
   * List all profile names (sorted alphabetically)
   */
  async list(): Promise<string[]> {
    await this.ensureDirs();

    const files = await fs.readdir(this.profilesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const names = jsonFiles.map(f => path.basename(f, '.json'));

    return names.sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get a profile settings by name
   * @returns Settings object
   * @throws CsmError if profile not found, name invalid, or file corrupted
   */
  async get(name: string): Promise<ClaudeSettings> {
    const result = await this.readProfileFile(name);
    if (result === null) {
      throw CsmError.profileNotFound(name);
    }
    return result;
  }

  /**
   * Check if a profile exists and get it if it does
   * @returns Settings object or null if not found
   * @throws CsmError if name invalid or file corrupted
   */
  async getIfExists(name: string): Promise<ClaudeSettings | null> {
    return this.readProfileFile(name);
  }

  /**
   * 内部方法：读取 profile 文件
   * @returns Settings 对象，如果文件不存在则返回 null
   * @throws CsmError 如果名称无效或文件损坏
   */
  private async readProfileFile(name: string): Promise<ClaudeSettings | null> {
    if (!validateProfileName(name)) {
      throw CsmError.profileNameInvalid(name, t('validation.nameInvalidChars'));
    }

    await this.ensureDirs();

    const filePath = this.getProfilePath(name);

    if (!(await fs.pathExists(filePath))) {
      return null;
    }

    try {
      const content = await fs.readJson(filePath);
      return content as ClaudeSettings;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw CsmError.profileCorrupted(name, message);
    }
  }

  /**
   * Create a new profile
   * @throws CsmError if profile already exists or name is invalid
   */
  async create(name: string, settings: ClaudeSettings): Promise<void> {
    if (!validateProfileName(name)) {
      throw CsmError.profileNameInvalid(name, t('validation.nameInvalidChars'));
    }

    await this.ensureDirs();

    if (await this.exists(name)) {
      throw CsmError.profileAlreadyExists(name);
    }

    await fs.writeJson(this.getProfilePath(name), settings, { spaces: 2 });
  }

  /**
   * Delete a profile
   * @returns true if deleted, false if not found
   * @throws CsmError if name is invalid
   */
  async delete(name: string): Promise<boolean> {
    if (!validateProfileName(name)) {
      throw CsmError.profileNameInvalid(name, t('validation.nameInvalidChars'));
    }

    await this.ensureDirs();

    const filePath = this.getProfilePath(name);

    if (!(await fs.pathExists(filePath))) {
      return false;
    }

    await fs.remove(filePath);
    return true;
  }

  /**
   * Check if a profile exists
   * @throws CsmError if name is invalid
   */
  async exists(name: string): Promise<boolean> {
    if (!validateProfileName(name)) {
      throw CsmError.profileNameInvalid(name, t('validation.nameInvalidChars'));
    }

    await this.ensureDirs();
    return fs.pathExists(this.getProfilePath(name));
  }

  /**
   * Rename a profile
   * @throws CsmError if profile not found, target exists, or names invalid
   */
  async rename(oldName: string, newName: string): Promise<void> {
    if (!validateProfileName(oldName)) {
      throw CsmError.profileNameInvalid(oldName, t('validation.nameInvalidChars'));
    }
    if (!validateProfileName(newName)) {
      throw CsmError.profileNameInvalid(newName, t('validation.nameInvalidChars'));
    }

    await this.ensureDirs();

    const oldPath = this.getProfilePath(oldName);
    const newPath = this.getProfilePath(newName);

    if (!(await fs.pathExists(oldPath))) {
      throw CsmError.profileNotFound(oldName);
    }

    if (await fs.pathExists(newPath)) {
      throw CsmError.profileAlreadyExists(newName);
    }

    await fs.move(oldPath, newPath);
  }

  /**
   * Get the file path for a profile
   */
  private getProfilePath(name: string): string {
    return path.join(this.profilesDir, `${name}.json`);
  }
}
