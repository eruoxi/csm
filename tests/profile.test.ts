import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileManager } from '../src/lib/profile';
import { ClaudeSettings } from '../src/types';
import { CsmError, CsmErrorCode } from '../src/utils/errors';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('ProfileManager', () => {
  let manager: ProfileManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temp directory for testing
    tempDir = path.join(os.tmpdir(), `csm-test-${Date.now()}`);
    manager = new ProfileManager(tempDir);
    await manager.ensureDirs();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  describe('ensureDirs', () => {
    it('should create profiles directory if it does not exist', async () => {
      const profilesDir = path.join(tempDir, 'profiles');
      expect(await fs.pathExists(profilesDir)).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      await expect(manager.ensureDirs()).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('should return empty array when no profiles exist', async () => {
      const profiles = await manager.list();
      expect(profiles).toEqual([]);
    });

    it('should return profiles sorted by name', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('zebra', settings);
      await manager.create('alpha', settings);
      await manager.create('middle', settings);

      const profiles = await manager.list();
      expect(profiles).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should return profile names as strings', async () => {
      const settings: ClaudeSettings = { language: 'en', env: { API_KEY: 'test' } };
      await manager.create('test-profile', settings);

      const profiles = await manager.list();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toBe('test-profile');
    });
  });

  describe('get', () => {
    it('should throw CsmError if profile does not exist', async () => {
      await expect(manager.get('nonexistent')).rejects.toThrow(CsmError);
      try {
        await manager.get('nonexistent');
      } catch (err) {
        expect((err as CsmError).code).toBe(CsmErrorCode.PROFILE_NOT_FOUND);
      }
    });

    it('should return settings directly', async () => {
      const settings: ClaudeSettings = {
        language: 'zh',
        permissions: { allow: ['Read(*)'] },
        enabledPlugins: { 'test-plugin': true }
      };
      await manager.create('full-profile', settings);

      const result = await manager.get('full-profile');
      expect(result).not.toBeNull();
      expect(result.language).toBe('zh');
      expect(result.permissions?.allow).toContain('Read(*)');
      expect(result.enabledPlugins?.['test-plugin']).toBe(true);
    });
  });

  describe('getIfExists', () => {
    it('should return null if profile does not exist', async () => {
      const settings = await manager.getIfExists('nonexistent');
      expect(settings).toBeNull();
    });

    it('should return settings if profile exists', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('existing-profile', settings);

      const result = await manager.getIfExists('existing-profile');
      expect(result).not.toBeNull();
      expect(result!.language).toBe('en');
    });
  });

  describe('create', () => {
    it('should create a profile with settings', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('new-profile', settings);

      const result = await manager.get('new-profile');
      expect(result).not.toBeNull();
      expect(result.language).toBe('en');
    });

    it('should throw error if profile already exists', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('duplicate', settings);

      await expect(manager.create('duplicate', settings)).rejects.toThrow();
    });

    it('should persist profile to file as settings format', async () => {
      const settings: ClaudeSettings = { language: 'fr' };
      await manager.create('persisted', settings);

      const filePath = path.join(tempDir, 'profiles', 'persisted.json');
      const exists = await fs.pathExists(filePath);
      expect(exists).toBe(true);

      const content = await fs.readJson(filePath);
      // Should be settings format, not Profile format
      expect(content.language).toBe('fr');
      expect(content.name).toBeUndefined(); // No Profile wrapper
      expect(content.settings).toBeUndefined(); // No Profile wrapper
    });
  });

  describe('delete', () => {
    it('should return false if profile does not exist', async () => {
      const result = await manager.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('should delete existing profile and return true', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('to-delete', settings);

      const result = await manager.delete('to-delete');
      expect(result).toBe(true);

      const profile = await manager.getIfExists('to-delete');
      expect(profile).toBeNull();
    });

    it('should remove profile file', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('remove-file', settings);

      await manager.delete('remove-file');

      const filePath = path.join(tempDir, 'profiles', 'remove-file.json');
      const exists = await fs.pathExists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return false if profile does not exist', async () => {
      const result = await manager.exists('nonexistent');
      expect(result).toBe(false);
    });

    it('should return true if profile exists', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('existing', settings);

      const result = await manager.exists('existing');
      expect(result).toBe(true);
    });
  });

  describe('rename', () => {
    it('should rename an existing profile', async () => {
      const settings: ClaudeSettings = { language: 'en' };
      await manager.create('old-name', settings);

      await manager.rename('old-name', 'new-name');

      expect(await manager.exists('old-name')).toBe(false);
      expect(await manager.exists('new-name')).toBe(true);

      const result = await manager.get('new-name');
      expect(result.language).toBe('en');
    });

    it('should throw if source profile does not exist', async () => {
      await expect(manager.rename('nonexistent', 'new-name')).rejects.toThrow(CsmError);
    });

    it('should throw if target profile already exists', async () => {
      await manager.create('source', { language: 'en' });
      await manager.create('target', { language: 'zh' });

      await expect(manager.rename('source', 'target')).rejects.toThrow(CsmError);
    });
  });
});
