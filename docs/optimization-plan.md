# ShellPilot — 技术架构文档

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | Electron 31 |
| 前端 | Vue 3 (Composition API) + TypeScript |
| UI | Element Plus |
| 构建 | Vite 4 |
| 终端 | xterm.js 5 + xterm-addon-fit + xterm-addon-search |
| 状态管理 | Pinia |
| SSH | ssh2 1.17 |
| 性能监控 | ssh2 远程命令采集 |
| 图表 | ECharts |

## 架构

```
┌───────────────────────────────────────────────────┐
│                  Electron 主进程                    │
│  ┌───────────┐ ┌───────────┐ ┌──────────────────┐ │
│  │SessionMgr │ │ SSHClient │ │ AIBridge         │ │
│  │           │ │ (shell)   │ │ (LLM+Agent+Guard)│ │
│  └───────────┘ └───────────┘ └──────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │         IPCRegistry / handlers                │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │         Preload (contextBridge)               │ │
│  └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
                         │ IPC
┌───────────────────────────────────────────────────┐
│              渲染进程 (Vue 3 + Pinia)               │
│  ┌─────────────────────────────────────────────┐   │
│  │  Stores: terminalStore, sshStore, aiStore,  │   │
│  │          commandStore, settingsStore, ...     │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Components: Terminal, FileBrowser,          │   │
│  │              StatsView, AIPanel              │   │
│  └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

## 关键设计决策

### SSH 连接

每个标签页独立 SSH 连接，通过 `tabId` 关联。使用 `ssh2.client.shell()` 建立持久交互式 shell 会话，支持 vim、top 等交互式命令。SFTP 文件传输使用独立通道，不阻塞终端操作。

### AI Agent

主进程 `AIBridge` 管理 LLM 调用和 Agent 循环。Agent 使用 Think → Act → Observe 循环自主探索服务器。命令安全检测分四级（低/中/高/危险），高危命令需用户确认。支持所有 OpenAI 兼容 API 格式。

### 状态管理

- `terminalStore` — 标签页管理、活动标签
- `commandStore` — 快捷命令、按连接的命令频次记录
- `aiStore` — AI 配置、按标签隔离的对话状态
- `settingsStore` — 主题、搜索高亮颜色
- `keyStore` — SSH 密钥管理
- `transferStore` — 文件传输进度

### 安全

- 使用 `contextBridge` 暴露 API，不启用 `nodeIntegration`
- AI 生成的命令经过 `SecurityGuard` 检测
- 危险命令（rm -rf /、dd 等）直接拒绝
- SSH 密钥存储在 localStorage（未来可升级为 Electron safeStorage）
