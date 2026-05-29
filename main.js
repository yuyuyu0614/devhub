/*
 * DevHub v2.0 - 个人 AI 编码中枢
 * 重构版：直接 HTTP 流式调用，直接 HTTP 流式调用
 */

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec, spawn } = require('child_process');

let mainWindow;
let activeRequest = null;
let requestId = 0;

// 应用数据目录
const appDataDir = path.join(require('os').homedir(), '.devhub-data');
const settingsPath = path.join(appDataDir, 'settings.json');
const projectsPath = path.join(appDataDir, 'projects.json');
const usagePath = path.join(appDataDir, 'usage.json');

// ========== 工具函数 ==========

function ensureAppDataDir() {
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  if (!fs.existsSync(path.join(appDataDir, 'sessions'))) {
    fs.mkdirSync(path.join(appDataDir, 'sessions'), { recursive: true });
  }
}

function initUsageFile() {
  if (!fs.existsSync(usagePath)) {
// — Path safety guard —
function isSafePath(targetPath) {
  const resolved = path.resolve(targetPath);
  if (resolved.startsWith(appDataDir)) return true;
  if (fs.existsSync(projectsPath)) {
    try {
      const projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
      for (const p of projects) {
        if (resolved.startsWith(path.resolve(p.path))) return true;
      }
    } catch (_) {}
  }
  return false;
}

    fs.writeFileSync(usagePath, JSON.stringify([]));
  }
}

function loadSettings() {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      console.error('加载设置失败:', e);
    }
  }
  return null;
}

function createDefaultSettings() {
  const defaultSettings = {
    apiBaseUrl: 'https://api.example.com/v1',
    apiKey: '',
    defaultModel: 'your-model-name',
    lastSelectedModel: null,
    dailyTokenBudget: 1000000,
    monthlyTokenBudget: 10000000,
    theme: 'light'
  };
  fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
  return defaultSettings;
}

// ========== HTTP 流式请求核心 ==========

function doStreamRequest(url, apiKey, body, rid, callbacks) {
  let _done = false;
  const isHttps = url.startsWith('https');
  const parsed = new URL(url);
  const transport = isHttps ? https : http;

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'Accept': 'text/event-stream'
    },
    timeout: 120000
  };

  console.log('[DevHub] Request #' + rid + ': POST ' + url);

  const req = transport.request(options, (res) => {
    if (res.statusCode >= 400) {
      let errBody = '';
      res.on('data', chunk => errBody += chunk);
      res.on('end', () => {
        console.error('[DevHub] HTTP ' + res.statusCode + ': ' + errBody.substring(0, 200));
        callbacks.onError('HTTP ' + res.statusCode + ': ' + errBody.substring(0, 200));
      });
      return;
    }

    let buffer = '';
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            callbacks.onToken(delta);
          }
          if (json.usage) {
            inputTokens = json.usage.prompt_tokens || 0;
            outputTokens = json.usage.completion_tokens || 0;
          }
        } catch (e) {
          // skip non-JSON lines
        }
      }
    });

    res.on('end', () => {
      console.log('[DevHub] Request #' + rid + ' done: ' + fullContent.length + ' chars');
      callbacks.onDone(fullContent, inputTokens, outputTokens);
    });

    res.on('error', (err) => {
      console.error('[DevHub] Response error #' + rid + ': ' + err.message);
      callbacks.onError(err.message);
    });
  });

  req.on('error', (err) => {
    console.error('[DevHub] Request error #' + rid + ': ' + err.message);
    callbacks.onError(err.message);
  });

  req.on('timeout', () => {
    console.error('[DevHub] Request #' + rid + ' timeout');
    req.destroy();
    if (!_done) {
      _done = true;
      callbacks.onError('请求超时');
    }
  });

  req.write(body);
  req.end();

  return req;
}

// Ollama 原生 /api/chat 端点 — SSE 格式与 OpenAI 不同
function doOllamaStreamRequest(url, apiKey, body, rid, callbacks) {
  let _done = false;
  const parsed = new URL(url);

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || 11434,
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson'
    },
    timeout: 180000
  };

  console.log('[DevHub] Ollama Request #' + rid + ': POST ' + url);

  const req = http.request(options, (res) => {
    if (res.statusCode >= 400) {
      let errBody = '';
      res.on('data', chunk => errBody += chunk);
      res.on('end', () => {
        console.error('[DevHub] Ollama HTTP ' + res.statusCode + ': ' + errBody.substring(0, 200));
        callbacks.onError('Ollama HTTP ' + res.statusCode + ': ' + errBody.substring(0, 200));
      });
      return;
    }

    let buffer = '';
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const content = json.message?.content || '';
          if (content) {
            fullContent += content;
            callbacks.onToken(content);
          }
          if (json.done) {
            inputTokens = json.prompt_eval_count || 0;
            outputTokens = json.eval_count || 0;
          }
        } catch (e) {
          // skip non-JSON lines
        }
      }
    });

    res.on('end', () => {
      console.log('[DevHub] Ollama Request #' + rid + ' done: ' + fullContent.length + ' chars');
      callbacks.onDone(fullContent, inputTokens, outputTokens);
    });

    res.on('error', (err) => {
      console.error('[DevHub] Ollama Response error #' + rid + ': ' + err.message);
      callbacks.onError(err.message);
    });
  });

  req.on('error', (err) => {
    console.error('[DevHub] Ollama Request error #' + rid + ': ' + err.message);
    callbacks.onError(err.message);
  });

  req.on('timeout', () => {
    console.error('[DevHub] Ollama Request #' + rid + ' timeout');
    req.destroy();
    if (!_done) {
      _done = true;
      callbacks.onError('Ollama 请求超时（模型较大时首次加载可能较慢）');
    }
  });

  req.write(body);
  req.end();

  return req;
}

// ========== 窗口 & 菜单 ==========

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'DevHub - AI 编码中枢',
    icon: path.join(__dirname, 'app.ico')
  });

  mainWindow.loadFile('renderer/index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建会话', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('new-session') },
        { label: '打开项目', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('open-project') },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.webContents.send('open-settings') },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '切换主题', click: () => mainWindow.webContents.send('toggle-theme') },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ========== IPC 处理器 ==========

ipcMain.handle('call-claude', async (event, { message, model, projectPath, options, history }) => {
  return new Promise((resolve, reject) => {
    // 取消上一个请求
    if (activeRequest) {
      activeRequest.destroy();
      activeRequest = null;
    }
    requestId++;
    const rid = requestId;

    const settings = loadSettings() || createDefaultSettings();
    const isOllama = options?.backend === 'ollama' || (model && model.startsWith('ollama:'));

    let apiBase, apiKey, modelName;

    if (isOllama) {
      apiBase = options?.baseUrl || 'http://127.0.0.1:11434';
      apiKey = 'not-needed';
      modelName = model ? model.replace(/^ollama:/, '').trim() : 'qwen2.5:1.5b';
    } else {
      apiBase = settings.apiBaseUrl || 'https://api.example.com/v1';
      apiKey = settings.apiKey || '';
      modelName = model || settings.defaultModel || 'your-model-name';
    }

    if (!isOllama && !apiKey) {
      reject(new Error('请先在设置中配置 API Key'));
      return;
    }

    // 构建消息历史
    const apiMessages = [];
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        apiMessages.push({ role, content: msg.content });
      });
    }
    apiMessages.push({ role: 'user', content: message });

    // 构建请求体
    let url, body;
    if (isOllama) {
      // 使用 Ollama 原生 /api/chat 端点（兼容所有版本）
      url = apiBase.replace(/\/+$/, '') + '/api/chat';
      body = JSON.stringify({
        model: modelName,
        messages: apiMessages,
        stream: true,
        options: { num_predict: 4096 }
      });
    } else {
      // OpenAI 兼容端点
      url = apiBase.replace(/\/+$/, '').replace(/\/anthropic$/, '') + '/v1/chat/completions';
      body = JSON.stringify({
        model: modelName,
        messages: apiMessages,
        stream: true,
        max_tokens: 4096
      });
    }

    const requester = isOllama ? doOllamaStreamRequest : doStreamRequest;
    activeRequest = requester(url, apiKey, body, rid, {
      onToken: (token) => {
        if (rid !== requestId) return;
        mainWindow.webContents.send('claude-output', token);
      },
      onDone: (fullText, inputTokens, outputTokens) => {
        if (rid !== requestId) { resolve({ stdout: '', stderr: '', code: 0 }); return; }
        activeRequest = null;
        if (inputTokens > 0 || outputTokens > 0) {
          mainWindow.webContents.send('claude-token-usage', { input: inputTokens, output: outputTokens });
        }
        resolve({ stdout: fullText, stderr: '', code: 0 });
      },
      onError: (errMsg) => {
        if (rid !== requestId) { resolve({ stdout: '', stderr: '', code: 0 }); return; }
        activeRequest = null;
        mainWindow.webContents.send('claude-error', errMsg);
        reject(new Error(errMsg));
      }
    });
  });
});

ipcMain.handle('stop-claude', () => {
  if (activeRequest) {
    activeRequest.destroy();
    activeRequest = null;
    requestId++;
  }
  return true;
});

ipcMain.handle('get-system-memory', () => {
  const os = require('os');
  return { free: os.freemem(), total: os.totalmem() };
});

ipcMain.handle('read-file', (event, filePath) => {
  if (!isSafePath(filePath)) throw new Error("Path not in allowed scope: " + filePath);
});

ipcMain.handle('write-file', (event, filePath, content) => {
  if (!isSafePath(filePath)) throw new Error("Path not in allowed scope: " + filePath);
  return true;
});

ipcMain.handle('read-dir', (event, dirPath) => {
  if (!isSafePath(dirPath)) throw new Error("Path not in allowed scope: " + dirPath);
});

ipcMain.handle('mkdir', (event, dirPath) => {
  if (!isSafePath(dirPath)) throw new Error("Path not in allowed scope: " + dirPath);
  return true;
});

ipcMain.handle('delete-file', (event, filePath) => {
  if (!isSafePath(filePath)) throw new Error("Path not in allowed scope: " + filePath);
  return true;
});

ipcMain.handle('open-file', async (event, filePath) => {
  const { shell } = require('electron');
  await shell.openPath(filePath);
  return true;
});

ipcMain.handle('get-settings', () => {
  ensureAppDataDir();
  const settings = loadSettings();
  if (!settings) return createDefaultSettings();
  return settings;
});

ipcMain.handle('save-settings', (event, newSettings) => {
  ensureAppDataDir();
  fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
  return true;
});

ipcMain.handle('get-projects', () => {
  ensureAppDataDir();
  if (fs.existsSync(projectsPath)) {
    return JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  }
  return [];
});

ipcMain.handle('save-projects', (event, projects) => {
  ensureAppDataDir();
  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
  return true;
});

ipcMain.handle('open-directory-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-sessions', (event, projectName) => {
  const sessionsDir = path.join(appDataDir, 'sessions', projectName || 'default');
  if (!fs.existsSync(sessionsDir)) return [];
  const sessions = fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), "utf8"));
        data.id = f.replace('.json', '');
        return data;
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
  sessions.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  return sessions;
});

ipcMain.handle('save-session', (event, projectName, sessionId, sessionData) => {
  const sessionsDir = path.join(appDataDir, 'sessions', projectName || 'default');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(path.join(sessionsDir, sessionId + '.json'), JSON.stringify(sessionData, null, 2));
  return true;
});

ipcMain.handle('load-session', (event, projectName, sessionId) => {
  const sessionPath = path.join(appDataDir, 'sessions', projectName || 'default', sessionId + '.json');
  if (!fs.existsSync(sessionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (e) {
    return null;
  }
});

ipcMain.handle('delete-session', (event, projectName, sessionId) => {
  const sessionPath = path.join(appDataDir, 'sessions', projectName || 'default', sessionId + '.json');
  if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
  return true;
});

ipcMain.handle('rename-session', (event, projectName, sessionId, newName) => {
  const sessionPath = path.join(appDataDir, 'sessions', projectName || 'default', sessionId + '.json');
  if (!fs.existsSync(sessionPath)) throw new Error('会话不存在');
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  sessionData.name = newName;
  fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
  return true;
});

ipcMain.handle('reorder-sessions', (event, projectName, orderedIds) => {
  const sessionsDir = path.join(appDataDir, 'sessions', projectName || 'default');
  if (!fs.existsSync(sessionsDir)) return true;
  orderedIds.forEach((id, index) => {
    const sessionPath = path.join(sessionsDir, id + '.json');
    if (fs.existsSync(sessionPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        data.order = index;
        fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2));
      } catch (e) { /* skip corrupted files */ }
    }
  });
  return true;
});

ipcMain.handle('save-token-usage', (event, usage) => {
  try {
    const usageData = fs.existsSync(usagePath) ? JSON.parse(fs.readFileSync(usagePath, 'utf8')) : [];
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    const month = date.substring(0, 7);
    usageData.push({
      id: Date.now().toString(),
      session_id: usage.sessionId,
      project_name: usage.projectName,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.inputTokens + usage.outputTokens,
      timestamp, date, month
    });
    fs.writeFileSync(usagePath, JSON.stringify(usageData, null, 2));
    return true;
  } catch (error) {
    throw new Error('保存 Token 用量失败: ' + error.message);
  }
});

ipcMain.handle('get-token-usage', (event, period, projectName) => {
  try {
    const usageData = fs.existsSync(usagePath) ? JSON.parse(fs.readFileSync(usagePath, 'utf8')) : [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    let filteredData = usageData;
    if (period === 'daily') filteredData = usageData.filter(item => new Date(item.timestamp) >= thirtyDaysAgo);
    else if (period === 'monthly') filteredData = usageData.filter(item => new Date(item.timestamp) >= oneYearAgo);
    if (projectName) filteredData = filteredData.filter(item => item.project_name === projectName);
    const groupedData = {};
    filteredData.forEach(item => {
      const key = period === 'monthly' ? item.month : item.date;
      if (!groupedData[key]) {
        groupedData[key] = {
          date: period === 'monthly' ? item.month : item.date,
          month: period === 'monthly' ? item.month : null,
          project_name: projectName || '所有项目',
          input_tokens: 0, output_tokens: 0, total_tokens: 0
        };
      }
      groupedData[key].input_tokens += item.input_tokens;
      groupedData[key].output_tokens += item.output_tokens;
      groupedData[key].total_tokens += item.total_tokens;
    });
    const result = Object.values(groupedData);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  } catch (error) {
    throw new Error('获取 Token 用量失败: ' + error.message);
  }
});

ipcMain.handle('get-token-summary', (event, period) => {
  try {
    const usageData = fs.existsSync(usagePath) ? JSON.parse(fs.readFileSync(usagePath, 'utf8')) : [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    let filteredData = usageData;
    if (period === 'daily') filteredData = usageData.filter(item => item.date === today);
    else if (period === 'monthly') filteredData = usageData.filter(item => item.month === currentMonth);
    return filteredData.reduce((acc, item) => {
      acc.input_tokens += item.input_tokens;
      acc.output_tokens += item.output_tokens;
      acc.total_tokens += item.total_tokens;
      return acc;
    }, { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  } catch (error) {
    throw new Error('获取 Token 摘要失败: ' + error.message);
  }
});

// ========== Git 操作 ==========

function execGit(cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, timeout: 30000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => stdout += d.toString());
    child.stderr.on('data', (d) => stderr += d.toString());
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `git exited ${code}`));
    });
    child.on('error', (err) => reject(new Error('git 命令未找到或无法执行: ' + err.message)));
  });
}

ipcMain.handle('git-diff', async (event, projectPath, stagedOnly) => {
  const args = ['diff'];
  if (stagedOnly) args.push('--cached');
  return execGit(projectPath, args);
});

ipcMain.handle('git-diff-file', async (event, projectPath, filePath) => {
  return execGit(projectPath, ['diff', '--', filePath]);
});

ipcMain.handle('git-staged-files', async (event, projectPath) => {
  const out = await execGit(projectPath, ['diff', '--cached', '--name-only']);
  return out ? out.split('\n').filter(Boolean) : [];
});

ipcMain.handle('git-changed-files', async (event, projectPath) => {
  const out = await execGit(projectPath, ['diff', '--name-only']);
  return out ? out.split('\n').filter(Boolean) : [];
});

ipcMain.handle('git-log', async (event, projectPath, count = 10) => {
  return execGit(projectPath, ['log', '--oneline', `-${count}`]);
});

ipcMain.handle('git-branch', async (event, projectPath) => {
  return execGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
});

ipcMain.handle('git-repo-root', async (event, projectPath) => {
  return execGit(projectPath, ['rev-parse', '--show-toplevel']);
});

// ========== 代码审查 ==========

function buildReviewPayload(diffContent, reviewStyle, language) {
  const prompts = {
    quick: '你是一位资深代码审查专家。请快速审查以下 git diff，重点关注：bug 风险、安全漏洞、性能问题。用中文简要列出发现的问题，每个问题标注严重程度（🔴严重/🟡中等/🟢建议）和涉及的文件。如果没有问题，回复"✅ 未发现问题"。',
    deep: '你是一位资深代码审查专家。请对以下 git diff 进行全面深度审查，按以下维度分析：\n1. 🔴 **严重问题**：bug、安全漏洞、数据丢失风险\n2. 🟡 **中等关注**：性能问题、错误处理缺失、边界条件\n3. 🟢 **优化建议**：代码风格、可维护性、最佳实践\n4. 📝 **总体评价**：代码质量评分(1-10)和总结\n\n对每个问题请注明：涉及的文件、行号范围、问题描述、修复建议。',
    security: '你是一位应用安全专家。请对以下 git diff 进行安全审查，重点关注：OWASP Top 10 漏洞、注入风险、认证/授权问题、敏感数据泄露、不安全的配置。按严重程度排列发现的问题。'
  };
  const systemPrompt = prompts[reviewStyle] || prompts.quick;
  const langHint = language ? `\n注意：代码主要使用 ${language} 语言。` : '';
  return {
    system: systemPrompt + langHint,
    user: `请审查以下代码变更：\n\n\`\`\`diff\n${diffContent.substring(0, 12000)}\n\`\`\``
  };
}

ipcMain.handle('code-review', async (event, { diffContent, model, reviewStyle, backend, projectPath, language }) => {
  return new Promise((resolve, reject) => {
    if (activeRequest) { activeRequest.destroy(); activeRequest = null; }
    requestId++;
    const rid = requestId;

    const settings = loadSettings() || createDefaultSettings();
    const isOllama = backend === 'ollama' || (model && model.startsWith('ollama:'));

    let apiBase, apiKey, modelName;
    if (isOllama) {
      apiBase = 'http://127.0.0.1:11434';
      apiKey = 'not-needed';
      modelName = model ? model.replace(/^ollama:/, '').trim() : 'qwen2.5:1.5b';
    } else {
      apiBase = settings.apiBaseUrl || 'https://api.example.com/v1';
      apiKey = settings.apiKey || '';
      modelName = model || settings.defaultModel || 'your-model-name';
    }

    if (!isOllama && !apiKey) {
      reject(new Error('请先在设置中配置 API Key'));
      return;
    }

    const { system, user } = buildReviewPayload(diffContent, reviewStyle || 'quick', language);

    let url, body;
    if (isOllama) {
      url = apiBase.replace(/\/+$/, '') + '/api/chat';
      body = JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: true,
        options: { num_predict: 4096 }
      });
    } else {
      url = apiBase.replace(/\/+$/, '').replace(/\/anthropic$/, '') + '/v1/chat/completions';
      body = JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: true,
        max_tokens: 4096
      });
    }

    const requester = isOllama ? doOllamaStreamRequest : doStreamRequest;
    activeRequest = requester(url, apiKey, body, rid, {
      onToken: (token) => {
        if (rid !== requestId) return;
        mainWindow.webContents.send('review-output', token);
      },
      onDone: (fullText, inputTokens, outputTokens) => {
        if (rid !== requestId) { resolve({ stdout: '', stderr: '', code: 0 }); return; }
        activeRequest = null;
        resolve({ result: fullText, inputTokens, outputTokens });
      },
      onError: (errMsg) => {
        if (rid !== requestId) { resolve({ result: '', inputTokens: 0, outputTokens: 0 }); return; }
        activeRequest = null;
        mainWindow.webContents.send('review-error', errMsg);
        reject(new Error(errMsg));
      }
    });
  });
});

ipcMain.handle('stop-review', () => {
  if (activeRequest) {
    activeRequest.destroy();
    activeRequest = null;
    requestId++;
  }
  return true;
});

// ========== Reviewdog (可选 lint 补充) ==========

ipcMain.handle('run-reviewdog', async (event, projectPath) => {
  return new Promise((resolve, reject) => {
    const child = spawn('reviewdog', ['-reporter=local', '-diff=git diff'], {
      cwd: projectPath,
      shell: true,
      timeout: 30000
    });

    let output = '';
    child.stdout.on('data', (d) => output += d.toString());
    child.stderr.on('data', (d) => output += d.toString());
    child.on('close', (code) => {
      if (code === 0 || code === 1) resolve(output.trim());
      else reject(new Error('Reviewdog 运行失败 (exit ' + code + '): ' + output));
    });
    child.on('error', () => reject(new Error('Reviewdog 未安装或不可用。请通过包管理器安装: choco install reviewdog / brew install reviewdog')));
  });
});

// ========== 启动 ==========

app.whenReady().then(() => {
  ensureAppDataDir();
  initUsageFile();
  createWindow();
  createMenu();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (activeRequest) activeRequest.destroy();
});
