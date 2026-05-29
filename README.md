# DevHub - 个人 AI 编码中枢桌面应用

一个通用的 AI Coding 桌面壳，不绑定特定项目。通过配置文件驱动，可适配任意代码仓库。

## 技术栈
- **前端**: Electron + 原生 HTML/CSS/JS
- **数据存储**: JSON 文件
- **Markdown**: marked.js
- **代码高亮**: highlight.js
- **ANSI 渲染**: ansi-to-html

## 核心功能

### 1. 聊天工作区
- 通过 child_process.spawn 调用系统安装的 AI 命令
- 流式读取 stdout 并显示在聊天区
- 支持 Markdown 渲染和代码高亮
- 聊天消息持久化到本地 JSON 文件

### 2. Token 用量监控
- 解析 AI 命令输出中的 token usage 信息
- 实时统计当前会话消耗的输入/输出 Token
- 所有用量数据写入 JSON 文件
- 显示今日和本月汇总用量

### 3. Skills 管理面板
- 读取当前项目目录下的 `.claude/skills/*.md` 文件
- 展示每个 Skill 的名称、描述、文件路径
- 支持新建、编辑、删除 Skill 文件

### 4. Agent 管理面板
- 读取当前项目目录下的 `.claude/agents/*.md` 文件
- 展示每个 Agent 的角色描述和关联的 Skills
- 支持新建、编辑、删除 Agent 定义文件

### 5. 项目切换
- 顶部项目选择下拉框，数据源来自配置文件
- 添加新项目：提供项目名称、本地路径、默认模型
- 切换项目时自动加载该项目的 Sessions 列表

### 6. 实时任务监视面板
- 捕获 AI 命令的 stdout 和 stderr，逐行滚动显示
- 支持 ANSI 颜色码渲染
- 自动解析输出中的关键事件，转换为可视化标签
- 任务历史记录保存所有操作列表

### 7. 全局设置页
- API Base URL 和 API Key 配置
- 默认模型选择 (your-model-name / your-model-flash 等)
- 日/月 Token 预算上限设置
- 主题切换 (浅色/深色)

## 安装和启动

### 基本启动方式

```bash
cd devhub
npm install
npm start
```

或者双击 `start.bat` (Windows)

### 创建桌面快捷方式

1. **自动创建** (推荐):
   - 双击 `创建快捷方式.bat`
   - 按照提示操作

2. **手动创建**:
   - 右键点击 `start.bat`
   - 选择 "发送到" → "桌面快捷方式"
   - 重命名为 "DevHub"
   - 右键点击快捷方式 → "属性" → "更改图标"
   - 选择 `app.ico` 作为图标

### 应用图标
- 图标文件: `app.ico` (从桌面素材文件夹复制)
- 窗口图标: 应用窗口左上角显示
- 任务栏图标: 应用运行时在任务栏显示
- 快捷方式图标: 桌面快捷方式使用

## 项目结构

```
devhub/
├── main.js              # Electron 主进程
├── preload.js           # Context Bridge 预加载脚本
├── package.json         # 项目配置和依赖
├── renderer/            # 渲染进程文件
│   ├── index.html      # 主界面 HTML
│   ├── style.css       # 样式文件
│   ├── app.js          # 主应用逻辑
│   └── task-parser.js  # 任务解析模块
├── app.ico             # 应用图标 (从桌面素材复制)
├── start.bat           # Windows 启动脚本
├── 创建快捷方式.bat    # 桌面快捷方式创建工具
├── create-shortcut.ps1 # PowerShell 快捷方式脚本
├── README.md           # 项目说明
└── 使用说明.md         # 详细使用说明
```

## 数据存储

所有配置和数据存储在用户目录下的 `.devhub-data/` 文件夹：

```
~/.devhub-data/
├── settings.json      # 全局设置
├── projects.json      # 项目列表
├── usage.json        # Token 用量数据 (JSON格式)
└── sessions/         # 各项目的会话历史
    ├── project1/
    │   └── session_1.json
    └── project2/
        └── session_1.json
```

## 关键约束

1. **零额外 Token 消耗**: DevHub 不得自行调用 AI 命令或直接请求 API（除用户手动发送消息外）
2. **无上下文附加**: 禁止在用户输入前后自动附加任何上下文、提示词或文件内容
3. **本地化统计**: Token 用量统计、任务监控等仅通过解析本地输出或读取本地日志实现
4. **无计费请求**: 首次启动引导、设置、更新检查等功能不得携带 API Key 或发起任何计费请求

## 界面特点

- 全部菜单、按钮、提示、错误消息使用中文
- 最小窗口尺寸 1200x800
- 响应式设计，支持侧边栏折叠
- 深色/浅色主题切换
- 代码高亮主题跟随深色/浅色自动调整

## 使用说明

1. **首次启动**: 应用会自动引导用户填写 API 设置
2. **添加项目**: 点击顶部状态栏的 "+" 按钮添加新项目
3. **开始聊天**: 选择项目 → 新建会话 → 输入消息 → Ctrl+Enter 发送
4. **监控任务**: 切换到 "📊 任务监视器" 标签页查看实时输出
5. **查看用量**: 切换到 "📋 Token 用量" 标签页查看统计图表

## 注意事项

- 假设 AI 命令已经在系统 PATH 中，且已通过环境变量配置好 Cloud 连接
- 所有文件操作都使用 Node.js 的 path 模块保证跨平台兼容性
- 应用遵循安全最佳实践，使用 contextIsolation 和 preload 脚本