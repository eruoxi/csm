/**
 * CSM 类型定义
 */

// Claude Code Settings 结构
export interface ClaudeSettings {
  env?: Record<string, string>;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  enabledPlugins?: Record<string, boolean>;
  language?: string;
  effortLevel?: string;
  autoUpdatesChannel?: string;
  autoMemoryEnabled?: boolean;
  [key: string]: unknown;
}

// 工具状态
export interface CsmState {
  activeProfile: string | null;
  version: string;
}

// 合并选项
export interface MergeOptions {
  merge?: string[];        // 要合并的字段
  noMerge?: boolean;       // 完全替换
  keepPermissions?: boolean;
  keepPlugins?: boolean;
}

// 备份信息
export interface BackupInfo {
  name: string;
  path: string;
  createdAt: string;
  size: number;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
