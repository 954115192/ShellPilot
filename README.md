# ShellPilot

AI 驱动的跨平台 SSH Shell 客户端，让运维从"记命令"变成"说意图"。

> 作为一个非专业运维人员，我经常记不住命令，每次都要切出去查文档，用过的终端对命令提示也不够友好。
> 一直想自己做一个趁手的终端工具，但苦于没有相关经验，迟迟没有动手。
> 直到小米的百亿 token 计划，抱着试试的心态用这个想法去申请，没想到小米直接批了 16 亿 token。
> 于是这个搁置已久的想法终于落地了——感谢小米。
> 项目前期使用 **Claude Code + DeepSeek** 搭建框架，收到小米 token 后全程使用 **MiMo 大模型**完成后续开发。

## 功能特性

### 终端 & SSH
- 多标签 SSH 连接（密码 / 私钥认证）
- 完整的 xterm.js 终端模拟
- SSH Keepalive 防止空闲断开，断连后任意键自动重连
- 命令建议系统（历史命令 + 快捷命令，光标下方弹出）
- 命令使用频次记录，越用越智能
- 常用命令一键添加为全局快捷命令
- Ctrl+C 智能切换：有选中时复制，无选中时发送 SIGINT
- Ctrl+V 粘贴剪贴板内容到终端
- 终端搜索高亮（支持自定义搜索颜色）

### 终端主题
- 6 套内置主题：默认 / Monokai / Dracula / Solarized Dark / Nord / GitHub
- 自定义主题：支持创建、编辑、删除，可自定义全部 20 项颜色（前景、背景、光标、ANSI 16 色等）
- 主题切换实时生效，保存到本地

### AI 智能助手
- **智能问答** — 解释命令、分析错误、回答运维问题
- **智能体** — 自主探索服务器，多步推理执行任务（如"帮我启动 MyApp"）
- 支持自定义 API（OpenAI / Ollama / 通义千问 / DeepSeek 等兼容格式）
- 终端选中文字右键直接询问 AI
- 命令安全检测（四级防护：低 / 中 / 高 / 危险）
- AI 侧边栏可拖拽调宽，宽度持久化

### 文件管理
- 远程文件浏览器（目录导航、上传、下载）
- 文件类型图标（代码 / 配置 / 图片 / 视频 / 音频 / 文档 / 压缩包等自动识别）
- 符号链接正确识别（跟随链接判断目标是文件还是文件夹）
- 文件传输进度追踪、取消
- 下载队列（可配置最大并发数 1-10，默认 3，超出排队等待）
- 文件夹递归下载，实时显示已传字节 / 总字节 + 下载速度
- 独立 SFTP 通道，每个并发下载独立通道，传输不阻塞其他操作
- 文件 / 文件夹复制粘贴（右键菜单）
- 文件夹压缩（tar.gz）、压缩包解压（tar.gz / tar.bz2 / tar.xz / tar / gz / zip）
- 列宽可拖拽调整

### 内置文件编辑器
- 基于 CodeMirror 6，支持两种打开模式（独立窗口 / 标签页，可在设置中切换）
- 语法高亮：JavaScript / TypeScript / JSX / TSX / JSON / HTML / CSS / SCSS / LESS / Python / XML / YAML / Markdown
- 多标签页管理（标签页模式下共用窗口，关闭最后一个标签自动关窗口）
- 搜索替换（Ctrl+F / Ctrl+H，支持上一个 / 下一个 / 全部替换）
- 二进制文件检测（打开前确认对话框）
- 大文件提示（>5MB 确认后打开）
- 未保存标记、Ctrl+S 保存

### 性能监控
- CPU / 内存 / 磁盘 / 网络实时监控
- ECharts 仪表盘和趋势曲线图
- 网络速度前端计算（基于累积字节差值）

### 界面
- 无边框窗口 + 自定义标题栏（拖拽移动、最小化、最大化、关闭）
- 深色 / 浅色 / 跟随系统主题
- SSH 密钥管理
- 快捷命令管理（内置 + 自定义）
- 文件编辑器模式设置（独立窗口 / 标签页）
- 文件传输并发数设置（1-10）

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建安装包

```bash
npm run build
npm run package
```

构建产物在 `release/` 目录下。

## AI 配置

在 **设置 → AI 助手** 中配置：

| 字段 | 说明 |
|------|------|
| API 地址 | 如 `https://api.openai.com/v1` |
| API Key | 你的 API Key（Ollama 可留空） |
| 模型 | 如 `gpt-4o`、`qwen2.5`、`deepseek-chat` |

支持所有兼容 OpenAI 格式的服务，包括：

| 服务 | API 地址 |
|------|---------|
| OpenAI | `https://api.openai.com/v1` |
| Ollama | `http://localhost:11434/v1` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | Vue 3 + TypeScript |
| UI 组件 | Element Plus |
| 状态管理 | Pinia |
| 构建工具 | Vite |
| SSH | ssh2 |
| 终端 | xterm.js 5.3 |
| 编辑器 | CodeMirror 6 |
| 图表 | ECharts |

## 目录结构

```
src/
├── main/                    # Electron 主进程
│   ├── ai/                  # AI Agent 框架
│   │   ├── LLMProvider.ts   # OpenAI 兼容 LLM 调用（流式）
│   │   ├── AgentLoop.ts     # Agent 核心循环（Think → Act → Observe）
│   │   ├── AgentTools.ts    # 工具集（执行命令、读文件、列目录、搜索）
│   │   ├── SecurityGuard.ts # 命令安全检测（四级防护）
│   │   └── AIBridge.ts      # 主进程管理器（per-tab Agent 实例）
│   ├── file/                # 文件管理（SFTP 上传/下载）
│   ├── ipc/                 # IPC 通信（handlers + registry）
│   ├── session/             # 会话管理
│   ├── ssh/                 # SSH 客户端（Keepalive + 重连）
│   └── stats/               # 性能监控（CPU/内存/磁盘/网络）
├── renderer/                # Vue 渲染进程
│   ├── components/
│   │   ├── ai/              # AI 侧边栏（问答 + 智能体）
│   │   ├── files/           # 文件浏览器 + 内置编辑器（CodeMirror 6）
│   │   ├── terminal/        # 终端组件（命令建议、复制粘贴）
│   │   └── sessions/        # 会话列表
│   ├── stores/              # Pinia 状态管理
│   │   ├── aiStore.ts       # AI 状态（per-tab 消息隔离）
│   │   ├── settingsStore.ts # 设置（主题、AI 配置、终端主题）
│   │   └── commandStore.ts  # 命令历史与频次统计
│   └── views/               # 页面视图
├── preload/                 # 预加载脚本（contextBridge API）
└── types/                   # TypeScript 类型声明
```

## 开发故事

这个项目的开发过程本身就是一个 AI 协作的故事：

- **Claude Code** 作为主力开发助手，负责架构设计、代码编写、调试修复
- **MiMo 大模型**（小米赠送的 token）提供 AI 能力支持
- 从零到功能完整的 SSH 客户端 + AI Agent，全程人机协作

项目中的 `docs/development-lessons.md` 记录了开发过程中的方法论和经验教训。

## 许可证

[MIT](LICENSE)
