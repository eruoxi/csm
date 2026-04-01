# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CSM (Claude Code Settings Manager) 是一个 CLI 工具，用于管理 Claude Code 的多个配置档案，支持在不同模型厂商配置之间一键切换。

## 技术栈

- **运行时**: Node.js + TypeScript
- **CLI 框架**: Commander.js
- **TUI 交互**: Inquirer.js
- **测试框架**: Vitest
- **打包工具**: pkg (编译为单文件可执行程序)

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build

# 测试
npm test

# 打包可执行文件 (Windows/macOS/Linux)
npm run pkg
```

## 目录结构

```
src/
├── cli.ts           # CLI 入口，注册所有命令
├── commands/        # 各命令实现 (create, show, edit, delete, list, use, switch, rename 等)
├── lib/             # 核心逻辑
│   ├── profile.ts   # Profile 管理核心
│   ├── settings.ts  # Settings 文件操作 + 备份功能
│   ├── merge.ts     # 配置合并逻辑
│   └── state.ts     # 状态管理
├── utils/           # 工具函数
│   ├── file.ts           # 文件路径操作
│   ├── logger.ts         # 日志输出
│   ├── validator.ts      # 数据验证（名称/配置）
│   ├── normalize.ts      # 配置规范化
│   ├── atomicWrite.ts    # 原子写入
│   ├── errors.ts         # 错误处理体系
│   └── backupValidator.ts # 备份验证
└── types/           # TypeScript 类型定义
```

## 核心数据结构

**Profile 文件** (`~/.claude/csm/profiles/<name>.json`):
- 直接存储 ClaudeSettings 对象
- 文件名即为配置名称
- 不包含额外元数据

**状态文件** (`~/.claude/csm/csm-state.json`):
- `activeProfile`: 当前激活的配置名称

## 配置合并策略

切换配置时支持部分字段继承:
- `--no-merge`: 完全替换
- `--keep-permissions`: 保留当前权限配置
- `--keep-plugins`: 保留当前插件配置
- `--merge <fields>`: 指定要合并的字段

合并优先级: 目标配置为基础，当前配置的指定合并字段覆盖目标配置。

## 关键路径

- 配置档案目录: `~/.claude/csm/profiles/`
- 当前配置文件: `~/.claude/settings.json`
- 备份目录: `~/.claude/csm/backups/`
- 状态文件: `~/.claude/csm/csm-state.json`

## 安全特性

- **路径遍历防护**: 验证所有用户输入路径，禁止 `..`、`/`、`\` 等危险字符
- **原子写入**: 采用临时文件 + 原子重命名策略，防止数据损坏
- **名称验证**: Profile 名称限制 64 字符，仅允许字母、数字、连字符、下划线
- **备份验证**: 恢复前验证 ZIP 文件完整性和路径安全性