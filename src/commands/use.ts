import { Command } from 'commander';
import inquirer from 'inquirer';
import { ProfileManager } from '../lib/profile';
import { SettingsManager } from '../lib/settings';
import { stateManager } from '../lib/state';
import { mergeSettings } from '../lib/merge';
import { success, error, info, warn } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import { highlightJson } from '../utils/logger';
import type { MergeOptions } from '../types';
import { t } from '../i18n';

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
    info(t('info.mergeMode'));
  } else {
    const mergeDetails: string[] = [];
    if (options.merge) {
      mergeDetails.push(t('info.mergeFields', { fields: String(options.merge) }));
    }
    if (options.keepPermissions) {
      mergeDetails.push(t('info.keepPermissions'));
    }
    if (options.keepPlugins) {
      mergeDetails.push(t('info.keepPlugins'));
    }
    if (mergeDetails.length > 0) {
      info(t('info.mergeOptions', { options: mergeDetails.join(', ') }));
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
  info(t('info.previewMode', { name }));
  console.log();

  // 显示合并选项
  displayMergeOptions(options);

  console.log();
  info(t('info.previewMerged'));
  console.log(highlightJson(mergedSettings));

  console.log();
  warn(t('info.previewHint'));
  info(t('info.previewUseReal'));
}

/**
 * 执行配置切换
 */
async function executeSwitch(
  name: string,
  options: Record<string, unknown>,
  profileManager: ProfileManager,
  settingsManager: SettingsManager
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

  success(t('success.switched', { name }));

  // 显示合并详情
  displayMergeOptions(options);

  // 显示当前生效的设置关键字段
  info(t('info.settingsFile', { path: settingsManager.getSettingsPath() }));
  if (mergedSettings.permissions) {
    const permCount = (mergedSettings.permissions.allow?.length || 0) +
      (mergedSettings.permissions.deny?.length || 0);
    info(t('info.permissionRules', { count: permCount }));
  }
  if (mergedSettings.enabledPlugins) {
    const pluginCount = Object.keys(mergedSettings.enabledPlugins).length;
    info(t('info.enabledPlugins', { count: pluginCount }));
  }
}

/**
 * 交互式选择配置
 */
async function interactiveSwitch(
  profileManager: ProfileManager,
  settingsManager: SettingsManager
): Promise<void> {
  // 1. 获取所有 profiles
  const profiles = await profileManager.list();

  if (profiles.length === 0) {
    warn(t('warn.noProfiles'));
    info(t('info.useCreateCommand'));
    return;
  }

  // 2. 获取当前激活的 profile
  const activeProfile = await stateManager.getActiveProfile();

  // 3. 构建选择列表，标记当前激活的配置
  const choices = profiles.map(name => {
    const isActive = name === activeProfile;
    return {
      name: isActive ? `${name} (${t('info.currentLabel')})` : name,
      value: name,
      short: name
    };
  });

  // 4. 使用 inquirer 显示选择列表
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: t('prompt.selectProfile'),
      choices,
      default: activeProfile || undefined
    }
  ]);

  const selectedName = answers.profile as string;

  // 如果选择的是当前配置，不执行切换
  if (selectedName === activeProfile) {
    info(t('info.alreadyCurrent', { name: selectedName }));
    return;
  }

  // 询问合并选项
  const mergeAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useMerge',
      message: t('prompt.keepCurrentSettings'),
      default: false
    }
  ]);

  const options: Record<string, unknown> = {};

  if (mergeAnswers.useMerge) {
    const keepAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'keepFields',
        message: t('prompt.selectKeepFields'),
        choices: [
          { name: t('prompt.keepPermissionsLabel'), value: 'permissions' },
          { name: t('prompt.keepPluginsLabel'), value: 'plugins' },
          { name: t('prompt.keepEnvLabel'), value: 'env' },
          { name: t('prompt.keepOtherLabel'), value: 'other' }
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
          message: t('prompt.inputOtherFields'),
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

  await executeSwitch(selectedName, options, profileManager, settingsManager);
}

export function initUseCommand(program: Command) {
  program
    .command('use [name]')
    .alias('switch')
    .description(t('cli.use.description'))
    .option('--merge <fields>', t('cli.use.optionMerge'))
    .option('--no-merge', t('cli.use.optionNoMerge'))
    .option('--keep-permissions', t('cli.use.optionKeepPermissions'))
    .option('--keep-plugins', t('cli.use.optionKeepPlugins'))
    .option('--dry-run', t('cli.use.optionDryRun'))
    .action(async (name, options) => {
      try {
        const profileManager = new ProfileManager();
        const settingsManager = new SettingsManager();

        if (name) {
          // 直接切换模式
          await executeSwitch(name, options, profileManager, settingsManager);
        } else {
          // 交互式选择模式
          await interactiveSwitch(profileManager, settingsManager);
        }
      } catch (err) {
        handleCommandError(err, 'switchFailed');
      }
    });
}
