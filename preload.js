const { contextBridge, ipcRenderer } = require('electron');

// 瀹夊叏鍦版毚闇?API 缁欐覆鏌撹繘绋?contextBridge.exposeInMainWorld('electronAPI', {
  // claude 鍛戒护璋冪敤
  callClaude: (message, model, projectPath, options, history) =>
    ipcRenderer.invoke('call-claude', { message, model, projectPath, options, history }),
  stopClaude: () => ipcRenderer.invoke('stop-claude'),
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  
  // 鏂囦欢绯荤粺鎿嶄綔
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  extractZip: (payload) => ipcRenderer.invoke('extract-zip', payload),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // 搴旂敤璁剧疆
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // 椤圭洰绠＄悊
  getProjects: () => ipcRenderer.invoke('get-projects'),
  saveProjects: (projects) => ipcRenderer.invoke('save-projects', projects),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
  // 浼氳瘽绠＄悊
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
  
  // 浜嬩欢鐩戝惉
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
  
  // Token 鐢ㄩ噺鏁版嵁搴?  saveTokenUsage: (usage) => ipcRenderer.invoke('save-token-usage', usage),
  getTokenUsage: (period, projectName) => ipcRenderer.invoke('get-token-usage', period, projectName),
  getTokenSummary: (period) => ipcRenderer.invoke('get-token-summary', period),
  
  // Git 鎿嶄綔
  gitDiff: (projectPath, stagedOnly) => ipcRenderer.invoke('git-diff', projectPath, stagedOnly),
  gitDiffFile: (projectPath, filePath) => ipcRenderer.invoke('git-diff-file', projectPath, filePath),
  gitStagedFiles: (projectPath) => ipcRenderer.invoke('git-staged-files', projectPath),
  gitChangedFiles: (projectPath) => ipcRenderer.invoke('git-changed-files', projectPath),
  gitLog: (projectPath, count) => ipcRenderer.invoke('git-log', projectPath, count),
  gitBranch: (projectPath) => ipcRenderer.invoke('git-branch', projectPath),
  gitRepoRoot: (projectPath) => ipcRenderer.invoke('git-repo-root', projectPath),

  // 浠ｇ爜瀹℃煡
  codeReview: (params) => ipcRenderer.invoke('code-review', params),
  stopReview: () => ipcRenderer.invoke('stop-review'),

  // Reviewdog lint 琛ュ厖
  runReviewdog: (projectPath) => ipcRenderer.invoke('run-reviewdog', projectPath),

  // 浠ｇ爜瀹℃煡浜嬩欢
  onReviewOutput: (callback) => {
    ipcRenderer.on('review-output', (event, data) => callback(data));
  },
  onReviewError: (callback) => {
    ipcRenderer.on('review-error', (event, data) => callback(data));
  },

  // 绉婚櫎浜嬩欢鐩戝惉
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});