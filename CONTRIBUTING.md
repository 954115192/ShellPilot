# 贡献指南

感谢你对 ShellPilot 的关注！

## 开发环境

- Node.js >= 18
- npm >= 9

## 开发流程

```bash
# 克隆仓库
git clone https://gitee.com/xiezhiyun/shell.git
cd shell

# 安装依赖
npm install

# 启动开发
npm run dev
```

## 代码规范

- TypeScript 严格模式
- Vue 3 Composition API（`<script setup>`）
- Pinia 管理状态
- 组件文件使用 PascalCase 命名

## 提交规范

提交信息格式：`类型: 描述`

- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 样式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

## 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/xxx`
3. 提交更改
4. 推送到你的 Fork
5. 发起 Pull Request
