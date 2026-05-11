# ShellPilot

AI 驱动的跨平台 SSH Shell 客户端，让运维从"记命令"变成"说意图"。

> 本项目全程使用 **Claude Code** + **MiMo 大模型**（小米赠送的 token）开发完成。

## 功能特性

### 终端 & SSH
- 多标签 SSH 连接（密码/私钥认证）
- 完整的 xterm.js 终端模拟
- 命令建议系统（历史命令 + 快捷命令，光标下方弹出）
- 命令使用频次记录，越用越智能

### AI 智能助手
- **智能问答** — 解释命令、分析错误、回答运维问题
- **智能体** — 自主探索服务器，多步推理执行任务（如"帮我启动 MyApp"）
- 支持自定义 API（OpenAI / Ollama / 通义千问 / DeepSeek 等兼容格式）
- 终端选中文字右键直接询问 AI
- 命令安全检测（三级防护：低/中/高/危险）

### 文件管理
- 远程文件浏览器（目录导航、上传、下载）
- 文件传输进度追踪、暂停/取消
- 独立 SFTP 通道，传输不阻塞其他操作

### 性能监控
- CPU / 内存 / 磁盘 / 网络实时监控
- ECharts 仪表盘和趋势曲线图
- 网络速度实时计算

### 其他
- 深色 / 浅色 / 跟随系统主题
- SSH 密钥管理
- 快捷命令管理（内置 + 自定义）
- 终端搜索高亮（可自定义颜色）

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
npm run package
```

## AI 配置

在 **设置 → AI 助手** 中配置：

| 字段 | 说明 |
|------|------|
| API 地址 | 如 `https://api.openai.com/v1` |
| API Key | 你的 API Key（Ollama 可留空） |
| 模型 | 如 `gpt-4o`、`qwen2.5`、`deepseek-chat` |

支持所有兼容 OpenAI 格式的服务，包括：
- OpenAI: `https://api.openai.com/v1`
- Ollama: `http://localhost:11434/v1`
- 通义千问: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- DeepSeek: `https://api.deepseek.com/v1`

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | Vue 3 + TypeScript |
| UI 组件 | Element Plus |
| 状态管理 | Pinia |
| 构建工具 | Vite |
| SSH | ssh2 |
| 终端 | xterm.js |
| 图表 | ECharts |

## 目录结构

```
src/
├── main/                    # Electron 主进程
│   ├── ai/                  # AI Agent 框架
│   │   ├── LLMProvider.ts   # OpenAI 兼容 LLM 调用
│   │   ├── AgentLoop.ts     # Agent 核心循环
│   │   ├── AgentTools.ts    # 工具集
│   │   ├── SecurityGuard.ts # 命令安全检测
│   │   └── AIBridge.ts      # 主进程管理器
│   ├── ipc/                 # IPC 通信
│   ├── session/             # 会话管理
│   ├── ssh/                 # SSH 客户端
│   └── stats/               # 性能监控
├── renderer/                # Vue 渲染进程
│   ├── components/
│   │   ├── ai/              # AI 侧边栏
│   │   ├── files/           # 文件浏览器
│   │   ├── terminal/        # 终端组件
│   │   └── sessions/        # 会话列表
│   ├── stores/              # Pinia 状态管理
│   └── views/               # 页面视图
├── preload/                 # 预加载脚本
└── types/                   # 类型声明
```

## 开发故事

这个项目的开发过程本身就是一个 AI 协作的故事：

- **Claude Code** 作为主力开发助手，负责架构设计、代码编写、调试修复
- **MiMo 大模型**（小米赠送的 token）提供 AI 能力支持
- 从零到功能完整的 SSH 客户端 + AI Agent，全程人机协作

项目中的 `docs/development-lessons.md` 记录了开发过程中的方法论和经验教训。

## 许可证

[MIT](LICENSE)
