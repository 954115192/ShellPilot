# Vite + Vue 3 + Electron + xterm.js + Element Plus 项目

## 项目简介

这是一个使用 Vue 3、Vite、Electron、xterm.js 和 Element Plus 构建的跨平台 shell 应用，支持远程 SSH 连接、命令执行、文件管理等功能。

## 技术特点

- **前端**: Vue 3 + Vite + TypeScript
- **桌面框架**: Electron
- **终端模拟**: xterm.js + xterm-addon-fit
- **UI 框架**: Element Plus
- **状态管理**: Pinia
- **SSH 连接**: ssh2 + ssh2-streams
- **文件操作**: SFTP 上传/下载
- **性能监控**: systeminformation

## 项目结构

```
src/
├── main/
│   ├── index.ts                    # Electron 主进程
│   ├── session/                    # 会话管理
│   ├── ssh/                        # SSH 客户端
│   ├── file/                       # 文件管理
│   ├── stats/                      # 性能监控
│   └── ipc/                        # IPC 处理
├── renderer/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   ├── stores/                     # 状态管理
│   ├── views/                      # 页面
│   ├── components/                 # 组件
│   └── composables/                # 组合式函数
└── preload/
```

## 功能模块

### 1. 会话管理
- SSH 连接配置
- 会话历史记录
- 多会话管理

### 2. SSH 连接
- 基于 ssh2 的 SSH 客户端
- SFTP 文件传输
- 命令执行

### 3. 终端模拟
- xterm.js 集成
- 键盘输入处理
- 自动补全

### 4. 文件管理
- 本地/远程文件浏览
- 上传/下载
- 拖拽功能

### 5. 性能监控
- CPU 使用率监控
- 内存使用监控
- 磁盘 I/O 监控
- 网络流量监控

## 启动命令

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 打包
npm run package
```

## 依赖安装

```bash
npm install
npm install electron
```

## 配置说明

### package.json
- 项目依赖和脚本定义
- Electron 和相关插件

### vite.config.ts
- Vite 构建配置
- 插件配置

### electron-builder.yml
- Electron 构建和打包配置

## 命令参考

### SSH 命令示例
```bash
ls -l              # 列出当前目录
cat file.txt       # 查看文件内容
mkdir newdir       # 创建目录
```

### 常用性能命令
```bash
top                # 查看进程
df -h              # 查看磁盘空间
free -h            # 查看内存
iftop              # 查看网络流量
```

## 调试技巧

1. **控制台输出**: 使用 `console.log` 调试
2. **SSH 调试**: 使用 `ssh2` 的日志功能
3. **性能监控**: 使用 `systeminformation` 的调试功能
4. **终端输出**: 通过 xterm.js 的控制台日志

## 常见问题

### 1. 无法连接到远程服务器
- 检查网络连接
- 检查 SSH 密码/密钥
- 检查服务器是否允许 SSH 连接

### 2. 终端显示乱码
- 确保终端编码正确
- 检查 xterm.js 配置

### 3. 文件上传失败
- 检查服务器权限
- 检查文件路径

## 参考文档

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Electron 文档](https://www.electronjs.org/)
- [xterm.js 文档](https://xtermjs.org/)
- [Element Plus 文档](https://element-plus.org/)
- [ssh2 文档](https://github.com/mscdex/ssh2)
- [systeminformation 文档](https://www.npmjs.com/package/systeminformation)

## 贡献指南

1. Fork 仓库
2. 创建特性分支
3. 提交更改
4. 发送 Pull Request

## 许可证

MIT
