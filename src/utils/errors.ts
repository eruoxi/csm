/**
 * CSM 错误处理模块
 *
 * 提供统一的错误类型和处理方式
 */

import { error as logError, info as logInfo } from './logger';
import { t } from '../i18n';

/**
 * CSM 错误代码
 */
export enum CsmErrorCode {
  // 配置相关错误
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  PROFILE_ALREADY_EXISTS = 'PROFILE_ALREADY_EXISTS',
  PROFILE_NAME_INVALID = 'PROFILE_NAME_INVALID',
  PROFILE_CORRUPTED = 'PROFILE_CORRUPTED',

  // 文件操作错误
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // 备份相关错误
  BACKUP_NOT_FOUND = 'BACKUP_NOT_FOUND',
  BACKUP_CORRUPTED = 'BACKUP_CORRUPTED',

  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * CSM 自定义错误类
 */
export class CsmError extends Error {
  public readonly code: CsmErrorCode;
  public readonly details?: string;

  constructor(code: CsmErrorCode, message: string, details?: string) {
    super(message);
    this.name = 'CsmError';
    this.code = code;
    this.details = details;
  }

  /**
   * 创建配置不存在错误
   */
  static profileNotFound(name: string): CsmError {
    return new CsmError(
      CsmErrorCode.PROFILE_NOT_FOUND,
      t('error.profileNotFound', { name }),
      t('info.useListCommand')
    );
  }

  /**
   * 创建配置已存在错误
   */
  static profileAlreadyExists(name: string): CsmError {
    return new CsmError(
      CsmErrorCode.PROFILE_ALREADY_EXISTS,
      t('error.profileAlreadyExists', { name }),
      t('info.useShowCommand', { name })
    );
  }

  /**
   * 创建配置名称无效错误
   */
  static profileNameInvalid(name: string, reason: string): CsmError {
    return new CsmError(
      CsmErrorCode.PROFILE_NAME_INVALID,
      t('error.profileNameInvalidWithReason', { name, reason }),
      reason
    );
  }

  /**
   * 创建配置文件损坏错误
   */
  static profileCorrupted(name: string, details?: string): CsmError {
    return new CsmError(
      CsmErrorCode.PROFILE_CORRUPTED,
      t('error.profileCorrupted', { name }),
      details
    );
  }

  /**
   * 创建验证错误
   */
  static validationError(errors: string[]): CsmError {
    return new CsmError(
      CsmErrorCode.VALIDATION_ERROR,
      t('validation.validationFailed'),
      errors.join('\n  - ')
    );
  }
}

/**
 * 格式化错误信息用于显示
 */
export function formatError(error: unknown): string {
  if (error instanceof CsmError) {
    let message = error.message;
    if (error.details) {
      message += `\n  ${t('info.tip', { message: error.details })}`;
    }
    return message;
  }

  return getErrorMessage(error);
}

/**
 * 从 unknown error 中提取错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * 获取错误代码
 */
export function getErrorCode(error: unknown): CsmErrorCode {
  if (error instanceof CsmError) {
    return error.code;
  }
  return CsmErrorCode.UNKNOWN_ERROR;
}

/**
 * 处理命令错误（统一错误处理模式）
 * 打印错误信息并退出进程
 */
export function handleCommandError(err: unknown, commandKey: string): never {
  if (err instanceof CsmError && err.details) {
    logError(err.message);
    logInfo(t('info.tip', { message: err.details }));
  } else {
    logError(`${t(`command.${commandKey}`)}: ${formatError(err)}`);
  }
  process.exit(1);
}
