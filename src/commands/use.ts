import { Command } from 'commander';
import inquirer from 'inquirer';
import { ProfileManager } from '../lib/profile';
import { SettingsManager } from '../lib/settings';
import { StateManager } from '../lib/state';
import { mergeSettings } from '../lib/merge';
import { success, error, info, warn } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import { highlightJson } from '../utils/logger';
import type { MergeOptions } from '../types';

/**
 * 构建 MergeOptions
 */
function buildMergeOptions(options: Record<string, unknown>): MergeOptions {
  const mergeOptions: MergeOptions = {};

  if (options.noMerge) {
    mergeOptions.noMerge = true;
  } else {
    if (options.merge) {
      mergeOptions.merge = (options.merge as string).split(',').map((f: string) => f.trim());
    }
    if (options.keepPermissions) {
      mergeOptions.keepPermissions = true;
    }
    if (options.keepPlugins) {
      mergeOptions.keepPlugins = true;
    }
  }

  return mergeOptions;
}

/**
 * 显示合并选项信息
 */
function displayMergeOptions(options: Record<string, unknown>): void {
  if (options.noMerge) {
    info('合并模式: 完全替换');
  } else {
    const mergeDetails: string[] = [];
    if (options.merge) {
      mergeDetails.push(`合并字段: ${options.merge}`);
    }
    if (options.keepPermissions) {
      mergeDetails.push('保留权限配置');
    }
    if (options.keepPlugins) {
      mergeDetails.push('保留插件配置');
    }
    if (mergeDetails.length > 0) {
      info(`合并选项: ${mergeDetails.join(', ')}`);
    }
  }
}

/**
 * 预览配置切换结果（dry-run 模式）
 */
async function previewSwitch(
  name: string,
  options: Record<string, unknown>,
  profileManager: ProfileManager,
  settingsManager: SettingsManager
): Promise<void> {
  // 检查 profile 存在
  const settings = await profileManager.get(name);

  // 读取当前设置
  const currentSettings = await settingsManager.read();

  // 构建 MergeOptions
  const mergeOptions = buildMergeOptions(options);

  // 计算合并结果
  const mergedSettings = mergeSettings(currentSettings, settings, mergeOptions);

  // 显示预览
  info(`[预览模式] 切换到配置 "${name}" 的结果:`);
  console.log();

  // 显示合并选项
  displayMergeOptions(options);

  console.log();
  info('合并后的配置:');
  console.log(highlightJson(mergedSettings));

  console.log();
  warn('提示: 这是预览模式，配置未被实际修改');
  info('移除 --dry-run 选项以实际执行切换');
}

/**
 * 执行配置切换
 */
async function executeSwitch(
  name: string,
  options: Record<string, unknown>,
  profileManager: ProfileManager,
  settingsManager: SettingsManager,
  stateManager: StateManager
): Promise<void> {
  // dry-run 模式
  if (options.dryRun) {
    return previewSwitch(name, options, profileManager, settingsManager);
  }

  // 检查 profile 存在
  const settings = await profileManager.get(name);

  // 构建 MergeOptions
  const mergeOptions = buildMergeOptions(options);

  // 执行切换
  const mergedSettings = await settingsManager.applyProfile(settings, mergeOptions);
  await stateManager.setActiveProfile(name);

  success(`已切换到配置 "${name}"`);

  // 显示合并详情
  displayMergeOptions(options);

  // 显示当前生效的设置关键字段
  info(`设置文件: ${settingsManager.getSettingsPath()}`);
  if (mergedSettings.permissions) {
    const permCount = (mergedSettings.permissions.allow?.length || 0) +
      (mergedSettings.permissions.deny?.length || 0);
    info(`权限规则: ${permCount} 条`);
  }
  if (mergedSettings.enabledPlugins) {
    const pluginCount = Object.keys(mergedSettings.enabledPlugins).length;
    info(`启用插件: ${pluginCount} 个`);
  }
}

/**
 * 交互式选择配置
 */
async function interactiveSwitch(
  profileManager: ProfileManager,
  settingsManager: SettingsManager,
  stateManager: StateManager
): Promise<void> {
  // 1. 获取所有 profiles
  const profiles = await profileManager.list();

  if (profiles.length === 0) {
    warn('没有可用的配置');
    info('使用 "csm create <name>" 创建一个新配置');
    return;
  }

  // 2. 获取当前激活的 profile
  const activeProfile = await stateManager.getActiveProfile();

  // 3. 构建选择列表，标记当前激活的配置
  const choices = profiles.map(name => {
    const isActive = name === activeProfile;
    return {
      name: isActive ? `${name} (当前)` : name,
      value: name,
      short: name
    };
  });

  // 4. 使用 inquirer 显示选择列表
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: '选择要切换的配置:',
      choices,
      default: activeProfile || undefined
    }
  ]);

  const selectedName = answers.profile as string;

  // 如果选择的是当前配置，不执行切换
  if (selectedName === activeProfile) {
    info(`"${selectedName}" 已是当前配置`);
    return;
  }

  // 询问合并选项
  const mergeAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useMerge',
      message: '是否保留某些当前设置?',
      default: false
    }
  ]);

  const options: Record<string, unknown> = {};

  if (mergeAnswers.useMerge) {
    const keepAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'keepFields',
        message: '选择要保留的字段:',
        choices: [
          { name: '权限配置 (permissions)', value: 'permissions' },
          { name: '插件配置 (enabledPlugins)', value: 'plugins' },
          { name: '环境变量 (env)', value: 'env' },
          { name: '其他设置', value: 'other' }
        ]
      }
    ]);

    const keepFields = keepAnswers.keepFields as string[];

    if (keepFields.includes('permissions')) {
      options.keepPermissions = true;
    }
    if (keepFields.includes('plugins')) {
      options.keepPlugins = true;
    }
    if (keepFields.includes('env')) {
      options.merge = 'env';
    }
    if (keepFields.includes('other')) {
      const otherFieldsAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'otherFields',
          message: '输入其他要保留的字段（逗号分隔）:',
        }
      ]);
      if (otherFieldsAnswer.otherFields) {
        const existing = options.merge ? (options.merge as string) : '';
        const otherFields = (otherFieldsAnswer.otherFields as string)
          .split(',')
          .map((f: string) => f.trim())
          .filter((f: string) => f);
        options.merge = existing ? `${existing},${otherFields.join(',')}` : otherFields.join(',');
      }
    }
  }

  await executeSwitch(selectedName, options, profileManager, settingsManager, stateManager);
}

export function initUseCommand(program: Command) {
  program
    .command('use [name]')
    .alias('switch')
    .description('切换到指定配置（无参数时交互式选择）')
    .option('--merge <fields>', '指定要合并的字段（逗号分隔）')
    .option('--no-merge', '完全替换，不合并任何字段')
    .option('--keep-permissions', '保留当前权限配置')
    .option('--keep-plugins', '保留当前插件配置')
    .option('--dry-run', '预览切换结果，不实际执行')
    .action(async (name, options) => {
      try {
        const profileManager = new ProfileManager();
        const settingsManager = new SettingsManager();
        const stateManager = new StateManager();

        if (name) {
          // 直接切换模式
          await executeSwitch(name, options, profileManager, settingsManager, stateManager);
        } else {
          // 交互式选择模式
          await interactiveSwitch(profileManager, settingsManager, stateManager);
        }
      } catch (err) {
        handleCommandError(err, '切换');
      }
    });
}
