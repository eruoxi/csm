/**
 * 配置合并逻辑
 */

import type { ClaudeSettings, MergeOptions } from '../types';

/**
 * Deep merge two values
 * - Objects are recursively merged
 * - Arrays are replaced (not merged)
 * - Target values take precedence over source values
 */
function deepMerge(source: unknown, target: unknown): unknown {
  // If target is null/undefined, return source
  if (target === null || target === undefined) {
    return source;
  }

  // If source is null/undefined, return target
  if (source === null || source === undefined) {
    return target;
  }

  // If either is not an object, target takes precedence
  if (typeof source !== 'object' || typeof target !== 'object') {
    return target;
  }

  // If either is an array, return target (arrays are replaced, not merged)
  if (Array.isArray(source) || Array.isArray(target)) {
    return target;
  }

  // Both are plain objects - merge them
  const result: Record<string, unknown> = { ...source } as Record<string, unknown>;

  for (const key of Object.keys(target as object)) {
    const targetValue = (target as Record<string, unknown>)[key];
    const sourceValue = (source as Record<string, unknown>)[key];

    if (targetValue !== undefined) {
      if (sourceValue !== undefined && typeof sourceValue === 'object' && typeof targetValue === 'object') {
        result[key] = deepMerge(sourceValue, targetValue);
      } else {
        result[key] = targetValue;
      }
    }
  }

  return result;
}

/**
 * Merge arrays by combining them and removing duplicates
 * Target values come first, then source's unique values
 */
function mergeArrays(source: unknown[] | undefined, target: unknown[] | undefined): unknown[] {
  if (!source && !target) return [];
  if (!source) return target ? [...target] : [];
  if (!target) return [...source];

  const result = [...target];
  for (const item of source) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Deep merge for permissions object specifically
 * Handles arrays by combining them (target first, then source's unique values)
 */
function deepMergePermissions(
  source: { allow?: string[]; deny?: string[] } | undefined,
  target: { allow?: string[]; deny?: string[] } | undefined
): { allow?: string[]; deny?: string[] } | undefined {
  if (!source && !target) return undefined;
  if (!source) return target;
  if (!target) return source;

  const result: { allow?: string[]; deny?: string[] } = {};

  // Merge allow arrays - target values first, then source's unique values
  if (source.allow || target.allow) {
    result.allow = mergeArrays(source.allow, target.allow) as string[];
  }

  // Merge deny arrays - target values first, then source's unique values
  if (source.deny || target.deny) {
    result.deny = mergeArrays(source.deny, target.deny) as string[];
  }

  return result;
}

/**
 * Merge settings from current into target based on options
 *
 * @param current - The current settings (source of values to merge)
 * @param target - The target settings (base, takes precedence)
 * @param options - Merge options
 * @returns Merged settings
 *
 * Rules:
 * - When noMerge is true, return target directly (complete replacement)
 * - merge array specifies which fields to deep merge from current into target
 * - keepPermissions adds 'permissions' to the merge list
 * - keepPlugins adds 'enabledPlugins' to the merge list
 */
export function mergeSettings(
  current: ClaudeSettings,
  target: ClaudeSettings,
  options: MergeOptions
): ClaudeSettings {
  // When noMerge is true, return target directly (complete replacement)
  if (options.noMerge) {
    return { ...target };
  }

  // Build the set of fields to merge
  const fieldsToMerge = new Set<string>();

  // Add fields from merge array
  if (options.merge) {
    for (const field of options.merge) {
      fieldsToMerge.add(field);
    }
  }

  // Add permissions if keepPermissions is true
  if (options.keepPermissions) {
    fieldsToMerge.add('permissions');
  }

  // Add enabledPlugins if keepPlugins is true
  if (options.keepPlugins) {
    fieldsToMerge.add('enabledPlugins');
  }

  // If no fields to merge, return target as-is
  if (fieldsToMerge.size === 0) {
    return { ...target };
  }

  // Start with a copy of target as the base
  const result: ClaudeSettings = { ...target };

  // Merge each specified field
  for (const field of fieldsToMerge) {
    const currentValue = current[field as keyof ClaudeSettings];
    const targetValue = target[field as keyof ClaudeSettings];

    // Special handling for permissions (contains arrays that should be combined)
    if (field === 'permissions') {
      result.permissions = deepMergePermissions(
        currentValue as { allow?: string[]; deny?: string[] } | undefined,
        targetValue as { allow?: string[]; deny?: string[] } | undefined
      );
      continue;
    }

    // For other fields, use standard deep merge
    const merged = deepMerge(currentValue, targetValue);

    // Only set the field if there's a value
    if (merged !== undefined) {
      (result as Record<string, unknown>)[field] = merged;
    }
  }

  return result;
}