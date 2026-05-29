const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // claude 命令调用
  callClaude: (message, model, projectPath, options, history) =>
    ipcRenderer.invoke('call-claude', { message, model, projectPath, options, history }),
  stopClaude: () => ipcRenderer.invoke('stop-claude'),
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  
  // 文件系统操作
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // 应用设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // 项目管理
  getProjects: () => ipcRenderer.invoke('get-projects'),
  saveProjects: (projects) => ipcRenderer.invoke('save-projects', projects),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
  // 会话管理
  getSessions: (projectName) => ipcRenderer.invoke('get-sessions', projectName),
  saveSession: (projectName, sessionId, sessionData) => 
    ipcRenderer.invoke('save-session', projectName, sessionId, sessionData),
  loadSession: (projectName, sessionId) => 
    ipcRenderer.invoke('load-session', projectName, sessionId),
  deleteSession: (projectName, sessionId) => 
    ipcRenderer.invoke('delete-session', projectName, sessionId),
  renameSession: (projectName, sessionId, newName) =>
    ipcRenderer.invoke('rename-session', projectName, sessionId, newName),
  reorderSessions: (projectName, orderedIds) =>
    ipcRenderer.invoke('reorder-sessions', projectName, orderedIds),
  
  // 事件监听
  onClaudeOutput: (callback) => {
    ipcRenderer.on('claude-output', (event, data) => callback(data));
  },
  onClaudeError: (callback) => {
    ipcRenderer.on('claude-error', (event, data) => callback(data));
  },
  onClaudeTokenUsage: (callback) => {
    ipcRenderer.on('claude-token-usage', (event, data) => callback(data));
  },
  onNewSession: (callback) => {
    ipcRenderer.on('new-session', () => callback());
  },
  onOpenProject: (callback) => {
    ipcRenderer.on('open-project', () => callback());
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },
  onToggleTheme: (callback) => {
    ipcRenderer.on('toggle-theme', () => callback());
  },
  
  // Token 用量数据库
  saveTokenUsage: (usage) => ipcRenderer.invoke('save-token-usage', usage),
  getTokenUsage: (period, projectName) => ipcRenderer.invoke('get-token-usage', period, projectName),
  getTokenSummary: (period) => ipcRenderer.invoke('get-token-summary', period),
  
  // Git 操作
  gitDiff: (projectPath, stagedOnly) => ipcRenderer.invoke('git-diff', projectPath, stagedOnly),
  gitDiffFile: (projectPath, filePath) => ipcRenderer.invoke('git-diff-file', projectPath, filePath),
  gitStagedFiles: (projectPath) => ipcRenderer.invoke('git-staged-files', projectPath),
  gitChangedFiles: (projectPath) => ipcRenderer.invoke('git-changed-files', projectPath),
  gitLog: (projectPath, count) => ipcRenderer.invoke('git-log', projectPath, count),
  gitBranch: (projectPath) => ipcRenderer.invoke('git-branch', projectPath),
  gitRepoRoot: (projectPath) => ipcRenderer.invoke('git-repo-root', projectPath),

  // 代码审查
  codeReview: (params) => ipcRenderer.invoke('code-review', params),
  stopReview: () => ipcRenderer.invoke('stop-review'),

  // Reviewdog lint 补充
  runReviewdog: (projectPath) => ipcRenderer.invoke('run-reviewdog', projectPath),

  // 代码审查事件
  onReviewOutput: (callback) => {
    ipcRenderer.on('review-output', (event, data) => callback(data));
  },
  onReviewError: (callback) => {
    ipcRenderer.on('review-error', (event, data) => callback(data));
  },

  // 移除事件监听
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});