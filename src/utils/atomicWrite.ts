/**
 * 原子写入工具
 *
 * 通过"写入临时文件 + 原子重命名"的方式确保写入操作的安全性，
 * 防止写入过程中崩溃导致的数据损坏。
 */

import fs from 'fs-extra';
import crypto from 'crypto';

/**
 * 生成安全的临时文件路径
 * 使用加密安全的随机数避免冲突
 */
function generateTempPath(filePath: string): string {
  const randomId = crypto.randomBytes(8).toString('hex');
  return `${filePath}.tmp-${Date.now()}-${randomId}`;
}

/**
 * 安全写入文件的核心逻辑
 */
async function safeWrite(
  tempPath: string,
  filePath: string,
  writeFn: () => Promise<void>
): Promise<void> {
  try {
    await writeFn();
    // 原子重命名（POSIX 系统上是原子操作）
    // Windows 上 rename 不是严格原子的，但仍然是安全的最佳实践
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // 清理可能残留的临时文件
    try {
      await fs.remove(tempPath);
    } catch {
      // 忽略清理错误
    }
    throw error;
  }
}

/**
 * 原子写入 JSON 文件
 *
 * @param filePath - 目标文件路径
 * @param data - 要写入的数据
 * @param options - 写入选项
 */
export async function writeJsonAtomic(
  filePath: string,
  data: unknown,
  options?: { spaces?: number | string }
): Promise<void> {
  const spaces = options?.spaces ?? 2;
  const tempPath = generateTempPath(filePath);

  await safeWrite(tempPath, filePath, () => fs.writeJson(tempPath, data, { spaces }));
}

/**
 * 原子写入文本文件
 *
 * @param filePath - 目标文件路径
 * @param content - 要写入的内容
 */
export async function writeFileAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const tempPath = generateTempPath(filePath);

  await safeWrite(tempPath, filePath, () => fs.writeFile(tempPath, content, 'utf-8'));
}
