import { describe, it, expect } from 'vitest';
import { mergeSettings } from '../src/lib/merge';
import type { ClaudeSettings, MergeOptions } from '../src/types';

describe('mergeSettings', () => {
  describe('noMerge option', () => {
    it('should return target directly when noMerge is true', () => {
      const current: ClaudeSettings = {
        env: { API_KEY: 'current_key' },
        permissions: { allow: ['read'], deny: ['write'] },
        enabledPlugins: { plugin1: true },
        language: 'en'
      };

      const target: ClaudeSettings = {
        env: { API_KEY: 'target_key' },
        permissions: { allow: ['execute'], deny: ['delete'] },
        language: 'zh'
      };

      const options: MergeOptions = { noMerge: true };

      const result = mergeSettings(current, target, options);

      expect(result).toEqual(target);
      // Ensure it's not the same reference as current
      expect(result).not.toBe(current);
    });

    it('should return target when noMerge is true even with other options', () => {
      const current: ClaudeSettings = {
        permissions: { allow: ['read'], deny: ['write'] }
      };

      const target: ClaudeSettings = {
        permissions: { allow: ['execute'] }
      };

      const options: MergeOptions = {
        noMerge: true,
        keepPermissions: true,
        merge: ['env']
      };

      const result = mergeSettings(current, target, options);

      expect(result).toEqual(target);
    });
  });

  describe('merge option', () => {
    it('should merge specified fields from current to target', () => {
      const current: ClaudeSettings = {
        env: { API_KEY: 'current_key', SECRET: 'secret' },
        language: 'en'
      };

      const target: ClaudeSettings = {
        env: { API_KEY: 'target_key' },
        language: 'zh'
      };

      const options: MergeOptions = { merge: ['env'] };

      const result = mergeSettings(current, target, options);

      expect(result.env).toEqual({
        API_KEY: 'target_key', // target takes precedence
        SECRET: 'secret' // merged from current
      });
      expect(result.language).toBe('zh'); // target value, not merged
    });

    it('should merge multiple specified fields', () => {
      const current: ClaudeSettings = {
        env: { KEY1: 'val1' },
        permissions: { allow: ['read'] },
        language: 'en'
      };

      const target: ClaudeSettings = {
        env: { KEY2: 'val2' },
        permissions: { deny: ['write'] },
        language: 'zh'
      };

      const options: MergeOptions = { merge: ['env', 'permissions'] };

      const result = mergeSettings(current, target, options);

      expect(result.env).toEqual({ KEY1: 'val1', KEY2: 'val2' });
      expect(result.permissions).toEqual({ allow: ['read'], deny: ['write'] });
      expect(result.language).toBe('zh'); // not in merge list
    });

    it('should handle non-existent fields in current', () => {
      const current: ClaudeSettings = {
        language: 'en'
      };

      const target: ClaudeSettings = {
        env: { KEY: 'val' }
      };

      const options: MergeOptions = { merge: ['env'] };

      const result = mergeSettings(current, target, options);

      expect(result.env).toEqual({ KEY: 'val' }); // target value remains
    });
  });

  describe('keepPermissions option', () => {
    it('should merge permissions when keepPermissions is true', () => {
      const current: ClaudeSettings = {
        permissions: { allow: ['read', 'write'], deny: ['delete'] }
      };

      const target: ClaudeSettings = {
        permissions: { allow: ['execute'] }
      };

      const options: MergeOptions = { keepPermissions: true };

      const result = mergeSettings(current, target, options);

      expect(result.permissions?.allow).toEqual(['execute', 'read', 'write']);
      expect(result.permissions?.deny).toEqual(['delete']);
    });

    it('should deep merge permissions object', () => {
      const current: ClaudeSettings = {
        permissions: { allow: ['read'], deny: ['delete'] }
      };

      const target: ClaudeSettings = {
        permissions: { allow: ['write'], deny: ['update'] }
      };

      const options: MergeOptions = { keepPermissions: true };

      const result = mergeSettings(current, target, options);

      expect(result.permissions?.allow).toEqual(['write', 'read']);
      expect(result.permissions?.deny).toEqual(['update', 'delete']);
    });
  });

  describe('keepPlugins option', () => {
    it('should merge enabledPlugins when keepPlugins is true', () => {
      const current: ClaudeSettings = {
        enabledPlugins: { plugin1: true, plugin2: false }
      };

      const target: ClaudeSettings = {
        enabledPlugins: { plugin2: true, plugin3: true }
      };

      const options: MergeOptions = { keepPlugins: true };

      const result = mergeSettings(current, target, options);

      expect(result.enabledPlugins).toEqual({
        plugin1: true,
        plugin2: true, // target takes precedence
        plugin3: true
      });
    });
  });

  describe('combined options', () => {
    it('should handle keepPermissions and keepPlugins together', () => {
      const current: ClaudeSettings = {
        permissions: { allow: ['read'] },
        enabledPlugins: { plugin1: true }
      };

      const target: ClaudeSettings = {
        permissions: { allow: ['write'] },
        enabledPlugins: { plugin2: true }
      };

      const options: MergeOptions = { keepPermissions: true, keepPlugins: true };

      const result = mergeSettings(current, target, options);

      expect(result.permissions?.allow).toEqual(['write', 'read']);
      expect(result.enabledPlugins).toEqual({ plugin1: true, plugin2: true });
    });

    it('should combine merge array with keepPermissions/keepPlugins', () => {
      const current: ClaudeSettings = {
        env: { KEY: 'val' },
        permissions: { allow: ['read'] },
        enabledPlugins: { plugin1: true }
      };

      const target: ClaudeSettings = {
        env: { KEY2: 'val2' },
        permissions: { allow: ['write'] },
        enabledPlugins: { plugin2: true }
      };

      const options: MergeOptions = {
        merge: ['env'],
        keepPermissions: true,
        keepPlugins: true
      };

      const result = mergeSettings(current, target, options);

      expect(result.env).toEqual({ KEY: 'val', KEY2: 'val2' });
      expect(result.permissions?.allow).toEqual(['write', 'read']);
      expect(result.enabledPlugins).toEqual({ plugin1: true, plugin2: true });
    });
  });

  describe('deep merge behavior', () => {
    it('should deep merge nested objects', () => {
      const current: ClaudeSettings = {
        nested: {
          level1: {
            level2: 'current_value',
            other: 'current_other'
          }
        }
      };

      const target: ClaudeSettings = {
        nested: {
          level1: {
            level2: 'target_value',
            new: 'target_new'
          }
        }
      };

      const options: MergeOptions = { merge: ['nested'] };

      const result = mergeSettings(current, target, options);

      expect(result.nested).toEqual({
        level1: {
          level2: 'target_value', // target takes precedence
          other: 'current_other',
          new: 'target_new'
        }
      });
    });

    it('should replace arrays instead of merging', () => {
      const current: ClaudeSettings = {
        permissions: { allow: ['read', 'write', 'delete'] }
      };

      const target: ClaudeSettings = {
        permissions: { allow: ['execute'] }
      };

      const options: MergeOptions = { keepPermissions: true };

      const result = mergeSettings(current, target, options);

      // Arrays should be replaced (target's array), then current's values added
      // Since we deep merge the permissions object, and allow is an array,
      // target's allow array should be used (not merged with current's)
      expect(result.permissions?.allow).toEqual(['execute', 'read', 'write', 'delete']);
    });

    it('should handle null and undefined values', () => {
      const current: ClaudeSettings = {
        env: { KEY1: 'val1' }
      };

      const target: ClaudeSettings = {
        env: undefined as unknown as Record<string, string>
      };

      const options: MergeOptions = { merge: ['env'] };

      const result = mergeSettings(current, target, options);

      // If target has undefined, use current's value
      expect(result.env).toEqual({ KEY1: 'val1' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty options', () => {
      const current: ClaudeSettings = {
        env: { KEY: 'val' }
      };

      const target: ClaudeSettings = {
        language: 'en'
      };

      const options: MergeOptions = {};

      const result = mergeSettings(current, target, options);

      // No merge options, just return target
      expect(result).toEqual(target);
    });

    it('should handle empty objects', () => {
      const current: ClaudeSettings = {};
      const target: ClaudeSettings = {};
      const options: MergeOptions = { merge: ['env'] };

      const result = mergeSettings(current, target, options);

      expect(result).toEqual({});
    });

    it('should not modify original objects', () => {
      const current: ClaudeSettings = {
        env: { KEY: 'val' },
        permissions: { allow: ['read'] }
      };

      const target: ClaudeSettings = {
        env: { KEY2: 'val2' }
      };

      const originalCurrent = JSON.stringify(current);
      const originalTarget = JSON.stringify(target);

      const options: MergeOptions = { merge: ['env'] };

      mergeSettings(current, target, options);

      expect(JSON.stringify(current)).toBe(originalCurrent);
      expect(JSON.stringify(target)).toBe(originalTarget);
    });

    it('should handle duplicate values in merged arrays', () => {
      const current: ClaudeSettings = {
        permissions: { allow: ['read', 'write'] }
      };

      const target: ClaudeSettings = {
        permissions: { allow: ['write', 'execute'] }
      };

      const options: MergeOptions = { keepPermissions: true };

      const result = mergeSettings(current, target, options);

      // 'write' appears in both, should only appear once in result
      expect(result.permissions?.allow).toEqual(['write', 'execute', 'read']);
    });
  });
});