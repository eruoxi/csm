# CSM - Claude Code Settings Manager

管理多个 Claude Code 配置档案的 CLI 工具，支持在不同模型厂商配置之间一键切换。

## 安装

### npm 安装

```bash
npm install -g @eruoxi/csm
```

### 直接下载

从 [GitHub Releases](https://github.com/eruoxi/csm/releases) 下载适合你系统的可执行文件。

## 快速开始

```bash
# 创建配置档案 (从当前配置复制)
csm create baidu-qianfan --copy-current

# 创建空配置
csm create anthropic-official --empty

# 列出所有配置
csm list

# 切换配置
csm use baidu-qianfan

# 查看当前配置
csm current

# 交互式切换 (use 无参数时的别名)
csm switch

# 或直接使用 use 无参数
csm use
```

## 命令列表

### 配置管理

| 命令                    | 说明          |
|-----------------------|-------------|
| `csm create <name>`   | 创建新配置档案     |
| `csm show <name>`     | 显示配置详情      |
| `csm edit <name>`     | 用编辑器打开配置文件 |
| `csm rename <old> <new>` | 重命名配置档案 |
| `csm delete <name>`   | 删除配置        |
| `csm list` / `csm ls` | 列出所有配置      |

### 配置切换

| 命令               | 说明       |
|------------------|----------|
| `csm use <name>` | 切换到指定配置 (无参数时交互式选择) |
| `csm switch`     | 交互式选择切换 (use 的别名) |
| `csm current`    | 显示当前激活配置 |

### 语言设置

| 命令                        | 说明                   |
|-----------------------------|------------------------|
| `csm lang [language]`       | 设置或切换显示语言     |
| `csm language [language]`   | 同上 (lang 的别名)     |

### 导入导出

| 命令                      | 说明            |
|-------------------------|---------------|
| `csm import <file>`     | 从 JSON 文件导入配置 |
| `csm export <name>`     | 导出配置为 JSON 文件 |
| `csm copy <src> <dest>` | 复制配置          |

### 备份恢复

| 命令                     | 说明             |
|------------------------|----------------|
| `csm backup`           | 备份所有配置到 zip 文件 |
| `csm restore <backup>` | 从备份恢复配置        |
| `csm backups`          | 列出所有备份文件       |

## 语言设置

```bash
# 交互式选择语言
csm lang

# 直接设置为英文
csm lang en-US

# 临时使用英文执行命令
csm --lang en-US list
```

语言优先级：
1. 命令行 `--lang` 参数
2. 持久化设置 (通过 `csm lang` 命令保存)
3. 环境变量 `CSM_LANG`
4. 系统语言检测
5. 默认中文

## 配置合并策略

切换配置时支持部分字段继承：

```bash
# 完全替换 (默认)
csm use anthropic-official

# 保留当前权限配置
csm use openai-proxy --keep-permissions

# 保留当前插件配置
csm use baidu-qianfan --keep-plugins

# 保留多个字段
csm use custom --keep-permissions --keep-plugins

# 指定合并字段
csm use custom --merge permissions,enabledPlugins,env

# 完全替换，不合并任何字段
csm use custom --no-merge
```

## 选项说明

### create 命令选项

```
-c, --copy-current        从当前 settings.json 复制配置
-e, --empty               创建空配置，跳过交互式设置
```

### use 命令选项

```
--merge <fields>          指定要合并的字段 (逗号分隔)
--no-merge                完全替换，不合并任何字段
--keep-permissions        保留当前权限配置
--keep-plugins            保留当前插件配置
--dry-run                 预览切换结果，不实际执行
```

### list 命令选项

```
-j, --json                以 JSON 格式输出
```

### current 命令选项

```
-s, --show-settings       同时显示当前 settings 内容
```

### edit 命令选项

```
--no-open                仅显示文件路径，不打开编辑器
```

### delete 命令选项

```
-f, --force               强制删除，不询问确认
```

### import 命令选项

```
-n, --name <name>         指定导入后的配置名称
-f, --force               覆盖已存在的同名配置
```

### export 命令选项

```
-o, --output <dir>        输出目录 (默认当前目录)
-f, --filename <name>     输出文件名 (默认使用配置名)
```

### restore 命令选项

```
-f, --force               覆盖现有配置，不询问
--skip-validation         跳过备份验证
--no-auto-backup          恢复前不自动备份当前配置
```

### backup 命令选项

```
-n, --name <name>         指定备份文件名（默认自动生成）
```

### backups 命令选项

```
-j, --json                以 JSON 格式输出
```

### lang 命令选项

```
[language]                 语言代码 (zh-CN 或 en-US)，不提供则交互式选择
```

支持的语言：
- `zh-CN` - 简体中文 (默认)
- `en-US` - English

## 数据存储

所有数据存储在 `~/.claude/` 目录下：

```
~/.claude/
├── settings.json          # 当前生效配置
├── csm/                   # CSM 数据目录
│   ├── profiles/          # 配置档案存储目录
│   │   ├── baidu-qianfan.json
│   │   └── anthropic-official.json
│   ├── backups/           # 备份存储目录
│   │   └── csm-backup-*.zip
│   └── csm-state.json     # 工具状态 (当前激活配置)
```

## 开发

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

## License

MIT
