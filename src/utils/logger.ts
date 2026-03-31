/**
 * 日志输出工具
 */
import chalk from 'chalk';
import { highlight } from 'cli-highlight';

// 成功消息 (绿色)
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

// 错误消息 (红色)
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

// 警告消息 (黄色)
export function warn(message: string): void {
  console.log(chalk.yellow('!'), message);
}

// 信息消息 (灰色)
export function info(message: string): void {
  console.log(chalk.gray('•'), message);
}

// 高亮 JSON 输出
export function highlightJson(json: object): string {
  const jsonString = JSON.stringify(json, null, 2);
  return highlight(jsonString, { language: 'json', ignoreIllegals: true });
}