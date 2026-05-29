class DevHubApp {
    constructor() {
        this.currentProject = null;
        this.currentSession = null;
        this.currentTab = 'chat';
        this.settings = null;
        this.projects = [];
        this.sessions = [];
        this.messages = [];
        this.isClaudeRunning = false;

        // 代码审查模块
        this.gito = null;
        this.codex = null;
        this.isReviewing = false;
        this.reviewStreamContent = '';

        this.init();
    }

    async init() {
        // 加载设置
        await this.loadSettings();

        // 加载项目
        await this.loadProjects();

        // 初始化UI
        this.initUI();
        await this.updateModelSelect();

        // 初始化事件监听
        this.initEventListeners();

        // 检查是否需要显示设置
        if (!this.settings.apiKey) {
            this.showSettingsModal();
        }

        this.checkPlugins();
    }

    async loadSettings() {
        try {
            this.settings = await window.electronAPI.getSettings();
            // 确保 settings 有默认值
            if (!this.settings) {
                this.settings = {};
            }
            this.updateTheme();
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = {};
        }
    }

    async loadProjects() {
        try {
            this.projects = await window.electronAPI.getProjects();
            this.updateProjectList();
        } catch (error) {
            console.error('加载项目失败:', error);
        }
    }

    async loadSessions(projectName) {
        try {
            this.sessions = await window.electronAPI.getSessions(projectName);
            this.updateSessionList();
        } catch (error) {
            console.error('加载会话失败:', error);
        }
    }

    initUI() {
        // 设置主题
        this.updateTheme();

        // 更新项目选择器
        this.updateProjectSelect();
    }

    initEventListeners() {
        // 标签页切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Token 页面事件
        document.getElementById('tokens-period')?.addEventListener('change', () => {
            this.loadTokenUsage();
        });

        // 主题切换
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // 发送消息
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        // 停止 Claude
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.stopClaude();
        });

        // Ctrl+Enter 发送消息
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 新建会话
        document.getElementById('new-session-btn').addEventListener('click', () => {
            this.createNewSession();
        });

        // 添加项目
        document.getElementById('add-project-btn').addEventListener('click', () => {
            this.showProjectModal();
        });

        // 项目选择
        document.getElementById('project-select').addEventListener('change', (e) => {
            this.selectProject(e.target.value);
        });

        // 模型选择变化时保存
        document.getElementById('model-select').addEventListener('change', async (e) => {
            const selectedModel = e.target.value;
            document.getElementById('current-model-display').textContent = selectedModel;
            try {
                // 始终保存最近选择的模型到全局设置（持久化）
                if (!this.settings) this.settings = {};
                this.settings.lastSelectedModel = selectedModel;
                await window.electronAPI.saveSettings(this.settings);

                // 如果有当前项目，同时也保存到项目的 defaultModel
                if (this.currentProject) {
                    const allProjects = await window.electronAPI.getProjects();
                    const updated = allProjects.map(p => {
                        if (p.name === this.currentProject.name) {
                            return { ...p, defaultModel: selectedModel };
                        }
                        return p;
                    });
                    await window.electronAPI.saveProjects(updated);
                    this.currentProject.defaultModel = selectedModel;
                    this.projects = updated;
                }
            } catch (err) {
                console.error('保存模型选择失败:', err);
            }
            // 切换模型后重新聚焦输入框，避免 Electron 原生 select 下拉导致焦点丢失
            document.getElementById('message-input').focus();
        });

        // Skills 管理
        document.getElementById('skills-btn').addEventListener('click', () => {
            this.switchTab('skills');
        });

        // Agents 管理
        document.getElementById('agents-btn').addEventListener('click', () => {
            this.switchTab('agents');
        });

        // 新建 Skill
        document.getElementById('new-skill-btn')?.addEventListener('click', () => {
            this.createSkill();
        });

        // 新建 Agent
        document.getElementById('new-agent-btn')?.addEventListener('click', () => {
            this.createAgent();
        });

        // 模态框关闭
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideModal();
            });
        });

        // 保存设置
        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        // 浏览项目路径
        document.getElementById('browse-path-btn').addEventListener('click', async () => {
            const path = await window.electronAPI.openDirectoryDialog();
            if (path) {
                document.getElementById('project-path').value = path;
            }
        });

        // 保存项目
        document.getElementById('save-project-btn').addEventListener('click', () => {
            this.saveProject();
        });

        // 清空任务
        document.getElementById('clear-tasks-btn')?.addEventListener('click', () => {
            document.getElementById('tasks-output').innerHTML = '<div class="tasks-placeholder" style="padding:32px;text-align:center;color:var(--text-secondary);">任务输出已清空<br><span style="font-size:12px;">发送消息后，AI 的实时输出将在此显示</span></div>';
        });

        // 刷新全部插件
        document.getElementById('refresh-all-plugins-btn')?.addEventListener('click', async () => {
            this.pluginStatus = await window.scanAllPlugins(true);
            this.refreshPluginList();
            this.showPluginManagement();
        });

        // Ollama 下载按钮
        document.getElementById('ollama-download-btn')?.addEventListener('click', () => this.downloadOllamaModel());

        // 主进程事件监听
        window.electronAPI.onNewSession(() => {
            this.createNewSession();
        });

        window.electronAPI.onOpenProject(() => {
            this.showProjectModal();
        });

        window.electronAPI.onOpenSettings(() => {
            this.showSettingsModal();
        });

        window.electronAPI.onToggleTheme(() => {
            this.toggleTheme();
        });

        window.electronAPI.onClaudeOutput((data) => {
            this.handleClaudeOutput(data);
        });

        window.electronAPI.onClaudeError((data) => {
            this.handleClaudeError(data);
        });

        window.electronAPI.onClaudeTokenUsage((data) => {
            this.updateTokenDisplay(data.input, data.output);
            this.saveTokenUsage(data.input, data.output);
        });

        // 代码审查事件
        this.initReviewEvents();

        // 窗口关闭事件
        window.addEventListener('beforeunload', async (e) => {
            if (this.currentProject && this.currentSession) {
                await this.saveCurrentSession();
            }
        });
    }

    // ========== 代码审查模块 ==========

    initReviewEvents() {
        // 初始化审查模块
        this.gito = new GitoReview(window.electronAPI);
        this.codex = new CodexReview(window.electronAPI);

        // 审查模式切换
        document.getElementById('review-mode')?.addEventListener('change', () => {
            this.updateReviewModelDisplay();
        });

        // 审查风格切换
        document.getElementById('review-style')?.addEventListener('change', () => {
            this.updateReviewModelDisplay();
        });

        // 审查工作区
        document.getElementById('review-workspace-btn')?.addEventListener('click', () => {
            this.runCodeReview('workspace');
        });

        // 审查暂存区
        document.getElementById('review-staged-btn')?.addEventListener('click', () => {
            this.runCodeReview('staged');
        });

        // 停止审查
        document.getElementById('review-stop-btn')?.addEventListener('click', () => {
            this.stopCodeReview();
        });

        // 查看 Diff
        document.getElementById('review-diff-btn')?.addEventListener('click', () => {
            this.toggleDiffPanel();
        });

        // 关闭 Diff 面板
        document.getElementById('review-diff-close')?.addEventListener('click', () => {
            document.getElementById('review-diff-panel').style.display = 'none';
        });

        // 审查输出流
        window.electronAPI.onReviewOutput((data) => {
            this.handleReviewOutput(data);
        });

        window.electronAPI.onReviewError((data) => {
            this.handleReviewError(data);
        });
    }

    async updateReviewModelDisplay() {
        const mode = document.getElementById('review-mode')?.value || 'gito';
        const display = document.getElementById('review-model-display');
        if (!display) return;

        if (mode === 'gito') {
            const health = await this.gito.healthCheck();
            if (health.ok) {
                display.textContent = `模型: ollama:${health.model}`;
                display.style.color = 'var(--text-secondary)';
            } else {
                display.textContent = health.message || 'Ollama 不可用';
                display.style.color = 'var(--danger)';
            }
        } else {
            const model = this.settings?.defaultModel || 'your-model-name';
            const hasKey = this.settings?.apiKey;
            display.textContent = hasKey ? `模型: ${model}` : '⚠️ 未配置 API Key';
            display.style.color = hasKey ? 'var(--text-secondary)' : 'var(--danger)';
        }

        // 更新审查风格选项的可用性
        const styleSelect = document.getElementById('review-style');
        if (styleSelect) {
            const deepOption = styleSelect.querySelector('option[value="deep"]');
            const securityOption = styleSelect.querySelector('option[value="security"]');
            if (mode === 'gito') {
                // 本地模型适合快速审查
                if (deepOption) deepOption.textContent = '深度审查 (本地模型较慢)';
                if (securityOption) securityOption.textContent = '安全审计 (推荐云端)';
            } else {
                if (deepOption) deepOption.textContent = '深度审查';
                if (securityOption) securityOption.textContent = '安全审计';
            }
        }
    }

    async loadGitInfo() {
        if (!this.currentProject) return;
        const statusText = document.getElementById('review-git-info');
        if (!statusText) return;

        try {
            const branch = await window.electronAPI.gitBranch(this.currentProject.path);
            statusText.textContent = `分支: ${branch}`;
        } catch {
            statusText.textContent = '非 Git 仓库或 git 不可用';
        }
    }

    async runCodeReview(target) {
        if (!this.currentProject) {
            await this.showAlert('请先在顶部选择项目');
            return;
        }

        const mode = document.getElementById('review-mode')?.value || 'gito';
        const style = document.getElementById('review-style')?.value || 'quick';

        // 切换到审查 tab
        this.switchTab('review');
        this.loadGitInfo();

        // 准备 UI
        this.isReviewing = true;
        this.reviewStreamContent = '';
        this.updateReviewButtons();

        const resultsDiv = document.getElementById('review-results');
        resultsDiv.innerHTML = `
            <div class="review-streaming">
                <span class="streaming-indicator"></span>
                <span style="color:var(--text-secondary);">
                    ${mode === 'gito' ? '🦙 Gito' : '☁️ Codex-Review'} 正在审查中 (${style})...
                </span>
            </div>
            <div id="review-stream-content" style="margin-top:12px;"></div>
        `;

        document.getElementById('review-results-title').textContent =
            mode === 'gito' ? '🦙 Gito 审查结果' : '☁️ Codex-Review 审查结果';

        const statusText = document.getElementById('review-status-text');
        if (statusText) {
            statusText.textContent = `正在审查 ${target === 'staged' ? '暂存区' : '工作区'}...`;
        }

        try {
            const reviewer = mode === 'gito' ? this.gito : this.codex;
            const bestModel = mode === 'gito' ? await this.gito.detectBestModel() : null;

            let result;
            if (target === 'staged') {
                result = await reviewer.reviewStaged(this.currentProject.path, {
                    reviewStyle: style,
                    model: bestModel,
                    onDone: (r) => this.finalizeReviewResult(r, mode)
                });
            } else {
                result = await reviewer.reviewWorkspace(this.currentProject.path, {
                    reviewStyle: style,
                    model: bestModel,
                    onDone: (r) => this.finalizeReviewResult(r, mode)
                });
            }

            if (result) this.finalizeReviewResult(result, mode);
        } catch (err) {
            this.handleReviewError(err.message || err.toString());
        }
    }

    handleReviewOutput(data) {
        this.reviewStreamContent += data;
        const streamDiv = document.getElementById('review-stream-content');
        if (streamDiv) {
            if (typeof marked !== 'undefined') {
                streamDiv.innerHTML = marked.parse(this.reviewStreamContent);
            } else {
                streamDiv.textContent = this.reviewStreamContent;
            }
            streamDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    handleReviewError(data) {
        this.isReviewing = false;
        this.updateReviewButtons();

        const resultsDiv = document.getElementById('review-results');
        resultsDiv.innerHTML = `
            <div style="padding:16px;color:var(--danger);background:rgba(255,59,48,0.08);border-radius:10px;border:1px solid var(--danger);">
                <div style="font-weight:600;margin-bottom:8px;">❌ 审查失败</div>
                <div style="font-size:13px;">${data}</div>
                <div style="font-size:12px;margin-top:8px;color:var(--text-secondary);">
                    提示：确认对应服务已启动（Ollama / Cloud API）
                </div>
            </div>
        `;

        const statusText = document.getElementById('review-status-text');
        if (statusText) statusText.textContent = '审查失败';
    }

    finalizeReviewResult(result, mode) {
        this.isReviewing = false;
        this.updateReviewButtons();

        const reviewer = mode === 'gito' ? this.gito : this.codex;
        const findings = reviewer.parseFindings ?
            reviewer.parseFindings(result.result || result) : [];

        const resultsDiv = document.getElementById('review-results');
        let html = '';

        // 如果有评分，显示总结卡片
        if (mode === 'codex') {
            const parsed = this.codex.parseResult(result.result || '');
            if (parsed.score) {
                html += `
                    <div class="review-summary-card">
                        <div class="score">${parsed.score}/10</div>
                        <div class="summary-text">${parsed.summary || '深度审查完成'}</div>
                    </div>`;
            }
        }

        // 渲染问题列表
        if (findings.length > 0) {
            findings.forEach(f => {
                html += `
                    <div class="review-finding-card ${f.severity}">
                        <div class="review-finding-header">
                            <span>${f.icon}</span>
                            <span>${f.title}</span>
                            <span class="review-severity-badge ${f.severity}">${f.severity.toUpperCase()}</span>
                        </div>
                        ${f.details.length > 0 ? `
                            <ul class="review-finding-details">
                                ${f.details.map(d => `<li>${d}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>`;
            });
        } else {
            // 没有解析到结构化问题时，显示原始输出
            html += `<div class="review-streaming">${marked.parse(result.result || result)}</div>`;
        }

        resultsDiv.innerHTML = html;

        // 更新 token 信息
        const tokenInfo = document.getElementById('review-token-info');
        if (tokenInfo && result.inputTokens) {
            tokenInfo.textContent = `Token: ${result.inputTokens} in + ${result.outputTokens} out`;
        }

        const statusText = document.getElementById('review-status-text');
        if (statusText) {
            const findingCount = findings.length;
            statusText.textContent = findingCount > 0
                ? `审查完成 - 发现 ${findingCount} 个问题`
                : '审查完成 - 未发现明显问题';
        }
    }

    updateReviewButtons() {
        const workspaceBtn = document.getElementById('review-workspace-btn');
        const stagedBtn = document.getElementById('review-staged-btn');
        const stopBtn = document.getElementById('review-stop-btn');

        if (this.isReviewing) {
            if (workspaceBtn) workspaceBtn.disabled = true;
            if (stagedBtn) stagedBtn.disabled = true;
            if (stopBtn) stopBtn.style.display = 'flex';
        } else {
            if (workspaceBtn) workspaceBtn.disabled = false;
            if (stagedBtn) stagedBtn.disabled = false;
            if (stopBtn) stopBtn.style.display = 'none';
        }
    }

    async stopCodeReview() {
        const mode = document.getElementById('review-mode')?.value || 'gito';
        const reviewer = mode === 'gito' ? this.gito : this.codex;
        await reviewer.stop();
        this.isReviewing = false;
        this.updateReviewButtons();
    }

    async toggleDiffPanel() {
        if (!this.currentProject) {
            await this.showAlert('请先选择项目');
            return;
        }

        const panel = document.getElementById('review-diff-panel');
        const isVisible = panel.style.display !== 'none';

        if (isVisible) {
            panel.style.display = 'none';
            return;
        }

        // 获取 diff 内容
        try {
            const diff = await window.electronAPI.gitDiff(this.currentProject.path, false);
            const diffContent = document.getElementById('review-diff-content');

            if (!diff) {
                diffContent.textContent = '工作区干净，没有变更';
            } else {
                // 简单语法高亮
                let colored = diff;
                colored = colored.replace(/^(\+.*)$/gm, '<span class="diff-add">$1</span>');
                colored = colored.replace(/^(-.*)$/gm, '<span class="diff-remove">$1</span>');
                colored = colored.replace(/^(@@.*@@)$/gm, '<span class="diff-header">$1</span>');
                colored = colored.replace(/^(diff --git.*)$/gm, '<span class="diff-header">$1</span>');
                diffContent.innerHTML = colored;
            }

            panel.style.display = 'flex';
        } catch (err) {
            await this.showAlert('获取 Git Diff 失败: ' + err.message);
        }
    }

    updateTheme() {
        const theme = this.settings?.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);

        // 更新主题按钮图标
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggleTheme() {
        if (!this.settings) return;

        this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
        this.updateTheme();
        this.saveSettings();
    }

    updateProjectSelect() {
        const select = document.getElementById('project-select');
        select.innerHTML = '<option value="">选择项目...</option>';

        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.name;
            option.textContent = project.name;
            select.appendChild(option);
        });
    }

    ensureCloudModelOptions(select) {
        const defs = [
            { value: 'your-model-name', label: 'Your Model (Pro)' },
            { value: 'your-model-flash', label: 'Your Model (Flash)' }
        ];
        defs.forEach(({ value, label }) => {
            if (!Array.from(select.options).some(opt => opt.value === value)) {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = label;
                select.appendChild(opt);
            }
        });
    }

    async appendOllamaModelOptions(select, result) {
        if (!result || !result.installed?.length) return;
        const mem = await window.electronAPI.getSystemMemory();
        const safeLimit = mem.free * 0.7;
        const GB = 1024 * 1024 * 1024;

        for (const m of result.installed) {
            const val = m.name.startsWith('ollama:') ? m.name : ('ollama:' + m.name);
            if (Array.from(select.options).some(opt => opt.value === val)) continue;

            const sizeGB = m.size ? (m.size / GB).toFixed(1) : '';
            const labels = [];
            let disabled = false;
            if (m.size > 8 * GB) {
                disabled = true;
                labels.push('(硬件要求极高 / Extreme HW requirement)');
            }
            if (m.size > safeLimit) {
                disabled = true;
                labels.push('(内存不足 / Insufficient RAM)');
            }
            if (m.size > 4 * GB) {
                labels.push('(硬件要求高 / High HW requirement)');
            }
            const sizeDisplay = sizeGB ? sizeGB + ' GB' : '';
            const labelSuffix = labels.length ? ' ' + labels.join(' ') : '';
            const bare = val.replace(/^ollama:/, '');

            const mainOption = document.createElement('option');
            mainOption.value = val;
            mainOption.textContent = `ollama: ${bare} ${sizeDisplay}${labelSuffix}`.trim();
            mainOption.disabled = disabled;
            select.appendChild(mainOption);
        }
    }

    async updateModelSelect(skipSelection = false) {
        const select = document.getElementById('model-select');
        this.ensureCloudModelOptions(select);
        const result = await window.checkOllamaStatus();
        await this.appendOllamaModelOptions(select, result);

        if (skipSelection) return;

        const optionExists = (v) => Boolean(v) && Array.from(select.options).some(opt => opt.value === v);
        let targetModel = this.settings?.lastSelectedModel;
        if (!optionExists(targetModel)) {
            targetModel = this.currentProject?.defaultModel;
        }
        if (!optionExists(targetModel)) {
            targetModel = this.settings?.defaultModel;
        }
        if (!optionExists(targetModel)) {
            targetModel = 'your-model-name';
        }
        if (optionExists(targetModel)) {
            select.value = targetModel;
        }
        document.getElementById('current-model-display').textContent = select.value || '';
    }

    updateProjectList() {
        const list = document.getElementById('project-list');
        list.innerHTML = '';

        this.projects.forEach(project => {
            const item = document.createElement('div');
            item.className = `project-item ${this.currentProject?.name === project.name ? 'active' : ''}`;
            item.innerHTML = `
                <span>📁</span>
                <span>${project.name}</span>
            `;
            item.addEventListener('click', () => {
                this.selectProject(project.name);
            });
            list.appendChild(item);
        });
    }

    updateSessionList() {
        const list = document.getElementById('session-list');
        list.innerHTML = '';

        if (this.sessions.length === 0) {
            list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">暂无会话<br><br>点击上方按钮新建</div>';
            return;
        }

        this.sessions.forEach((session, index) => {
            const item = document.createElement('div');
            item.className = `session-item ${this.currentSession?.id === session.id ? 'active' : ''}`;
            item.draggable = true;
            item.dataset.sessionId = session.id;
            item.dataset.index = index;

            // 从 messages 数组安全地获取最后一条消息
            const lastMsgContent = (session.messages && session.messages.length > 0)
                ? (session.messages[session.messages.length - 1].content || '')
                : '';
            const preview = lastMsgContent.substring(0, 30) + (lastMsgContent.length > 30 ? '...' : '');

            item.innerHTML = `
                <span>💬</span>
                <div class="session-info">
                    <div class="session-name">${session.name}</div>
                    <div class="session-preview">${preview || '新会话'}</div>
                </div>
                <button class="delete-session-btn" data-session-id="${session.id}">🗑️</button>
            `;
            item.addEventListener('click', () => {
                this.selectSession(session.id);
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showSessionContextMenu(e, session);
            });

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', session.id);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromId = e.dataTransfer.getData('text/plain');
                const toId = session.id;
                if (fromId !== toId) {
                    await this.reorderSessions(fromId, toId);
                }
            });

            // 删除按钮事件
            const deleteBtn = item.querySelector('.delete-session-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发父元素的点击事件
                this.deleteSession(session.id);
            });

            list.appendChild(item);
        });
    }

    switchTab(tabName) {
        // 更新标签页状态
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // 更新内容区域
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // 加载特定标签页的数据
        if (tabName === 'skills') {
            this.loadSkills();
        } else if (tabName === 'agents') {
            this.loadAgents();
        } else if (tabName === 'tokens') {
            this.loadTokenUsage();
        } else if (tabName === 'plugins') {
            this.showPluginManagement();
        } else if (tabName === 'review') {
            this.updateReviewModelDisplay();
            this.loadGitInfo();
        }
    }

    async selectProject(projectName) {
        if (!projectName) return;

        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;

        this.currentProject = project;

        // 更新UI
        this.updateProjectList();
        const projectModel = project.defaultModel;
        await this.updateModelSelect(true);
        const select = document.getElementById('model-select');
        const optionExists = (v) => Boolean(v) && Array.from(select.options).some(opt => opt.value === v);
        let targetModel = projectModel;
        if (!optionExists(targetModel)) {
            targetModel = this.settings?.lastSelectedModel;
        }
        if (!optionExists(targetModel)) {
            targetModel = this.settings?.defaultModel;
        }
        if (!optionExists(targetModel)) {
            targetModel = 'your-model-name';
        }
        if (optionExists(targetModel)) {
            select.value = targetModel;
        }
        document.getElementById('current-model-display').textContent = select.value || '';

        // 加载会话
        await this.loadSessions(projectName);

        // 清空当前聊天
        this.messages = [];
        this.updateChatMessages();

        // 更新审查面板
        if (this.currentTab === 'review') {
            this.updateReviewModelDisplay();
            this.loadGitInfo();
        }

        // 如果有会话，加载最后一个
        if (this.sessions.length > 0) {
            await this.selectSession(this.sessions[0].id);
        }
    }

    async selectSession(sessionId) {
        if (!this.currentProject) return;

        // 保存当前会话
        if (this.currentSession) {
            await this.saveCurrentSession();
        }

        try {
            const sessionData = await window.electronAPI.loadSession(this.currentProject.name, sessionId);
            if (!sessionData) {
                console.error('会话数据为空:', sessionId);
                return;
            }
            this.currentSession = { id: sessionId, ...sessionData };
            this.messages = sessionData.messages || [];

            this.updateSessionList();
            this.updateChatMessages();
        } catch (error) {
            console.error('加载会话失败:', error);
        }
    }

    async createNewSession() {
        if (!this.currentProject) {
            await this.showAlert('请先选择项目');
            return;
        }

        const sessionId = Date.now().toString();
        const sessionName = `会话 ${new Date().toLocaleString()}`;

        const sessionData = {
            name: sessionName,
            project: this.currentProject.name,
            createdAt: new Date().toISOString(),
            messages: []
        };

        try {
            await window.electronAPI.saveSession(this.currentProject.name, sessionId, sessionData);
            await this.loadSessions(this.currentProject.name);
            await this.selectSession(sessionId);
        } catch (error) {
            console.error('创建会话失败:', error);
        }
    }

    async sendMessage() {
        // 防止重复发送：如果已有请求运行中，先停止
        if (this.isClaudeRunning) {
            await window.electronAPI.stopClaude();
            this.isClaudeRunning = false;
            this._taskStreamingEl = null;
        }

        const input = document.getElementById('message-input');
        const message = input.value.trim();

        if (!message) return;
        if (!this.currentProject) {
            await this.showAlert('请先选择项目');
            return;
        }

        // 添加用户消息
        this.addMessage('user', message);
        input.value = '';

        const model = document.getElementById('model-select').value;

        // 保存会话
        await this.saveCurrentSession();

        // 构建调用参数
        let callOptions = {};
        if (model.startsWith('ollama:')) {
            callOptions = {
                backend: 'ollama',
                baseUrl: 'http://127.0.0.1:11434'
            };
        }

        try {
            this.isClaudeRunning = true;
            this.updateSendButton();
            this._taskStreamingEl = null;

            const history = this.messages.slice(0, -1);
            await window.electronAPI.callClaude(message, model, this.currentProject.path, callOptions, history);
        } catch (error) {
            console.error('调用 Claude 失败:', error);
            this.addMessage('assistant', `错误: ${error.message}`);
        } finally {
            this.isClaudeRunning = false;
            this._taskStreamingEl = null;
            this.updateSendButton();
        }
    }

    async stopClaude() {
        await window.electronAPI.stopClaude();
        this.isClaudeRunning = false;
        this.updateSendButton();
    }

    handleClaudeOutput(data) {
        this.addTaskOutput(data, 'stream');
        this.updateTokenSummary();
        this.appendToLastMessage(data);
    }

    handleClaudeError(data) {
        this._taskStreamingEl = null;
        this.addTaskOutput(data, 'error');
    }

    async deleteSession(sessionId) {
        if (!this.currentProject) return;

        if (!await this.showConfirm('确定要删除这个会话吗？', '删除会话')) {
            return;
        }

        try {
            await window.electronAPI.deleteSession(this.currentProject.name, sessionId);

            // 刷新会话列表
            await this.loadSessions(this.currentProject.name);

            // 如果当前会话被删除，清空聊天区
            if (this.currentSession?.id === sessionId) {
                this.currentSession = null;
                this.messages = [];
                this.updateChatMessages();
            }
        } catch (error) {
            console.error('删除会话失败:', error);
            await this.showAlert('删除会话失败: ' + error.message);
        }
    }

    showSessionContextMenu(e, session) {
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:10000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;padding:4px 0;min-width:120px;box-shadow:0 4px 12px rgba(0,0,0,0.2);`;

        const renameItem = document.createElement('div');
        renameItem.className = 'context-menu-item';
        renameItem.textContent = '重命名';
        renameItem.style.cssText = 'padding:8px 16px;cursor:pointer;white-space:nowrap;';
        renameItem.addEventListener('mouseenter', () => renameItem.style.background = 'var(--hover-bg)');
        renameItem.addEventListener('mouseleave', () => renameItem.style.background = '');
        renameItem.addEventListener('click', () => {
            menu.remove();
            this.renameSession(session.id);
        });

        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '删除';
        deleteItem.style.cssText = 'padding:8px 16px;cursor:pointer;white-space:nowrap;color:#e74c3c;';
        deleteItem.addEventListener('mouseenter', () => deleteItem.style.background = 'var(--hover-bg)');
        deleteItem.addEventListener('mouseleave', () => deleteItem.style.background = '');
        deleteItem.addEventListener('click', () => {
            menu.remove();
            this.deleteSession(session.id);
        });

        menu.appendChild(renameItem);
        menu.appendChild(deleteItem);
        document.body.appendChild(menu);

        const closeMenu = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    async renameSession(sessionId) {
        if (!this.currentProject) return;

        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        const newName = await this.showPrompt('输入新的会话名称：', '重命名会话', session.name);
        if (!newName || newName === session.name) return;

        try {
            await window.electronAPI.renameSession(this.currentProject.name, sessionId, newName);
            await this.loadSessions(this.currentProject.name);
        } catch (error) {
            console.error('重命名会话失败:', error);
            await this.showAlert('重命名会话失败: ' + error.message);
        }
    }

    async reorderSessions(fromId, toId) {
        if (!this.currentProject) return;

        const fromIndex = this.sessions.findIndex(s => s.id === fromId);
        const toIndex = this.sessions.findIndex(s => s.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;

        const moved = this.sessions.splice(fromIndex, 1)[0];
        this.sessions.splice(toIndex, 0, moved);

        this.updateSessionList();

        const orderedIds = this.sessions.map(s => s.id);
        try {
            await window.electronAPI.reorderSessions(this.currentProject.name, orderedIds);
        } catch (error) {
            console.error('保存会话顺序失败:', error);
        }
    }

    addMessage(role, content) {
        const message = {
            role,
            content,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        };

        this.messages.push(message);
        this.updateChatMessages();
    }

    appendToLastMessage(content) {
        if (this.messages.length === 0) {
            this.addMessage('assistant', content);
            return;
        }

        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage.role === 'assistant') {
            lastMessage.content += content;
        } else {
            this.addMessage('assistant', content);
            return;
        }

        // 直接更新最后一个消息的 DOM，避免全量重建导致闪烁
        const container = document.getElementById('chat-messages');
        const lastEl = container.lastElementChild;
        if (lastEl && lastEl.classList.contains('message') && lastEl.classList.contains('assistant')) {
            const contentEl = lastEl.querySelector('.message-content');
            if (contentEl) {
                let html = lastMessage.content;
                if (typeof marked !== 'undefined') {
                    html = marked.parse(html);
                }
                if (typeof hljs !== 'undefined') {
                    html = html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                        const highlighted = hljs.highlight(code, { language: lang }).value;
                        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                    });
                }
                contentEl.innerHTML = html;
            }
        }

        container.scrollTop = container.scrollHeight;
    }

    updateChatMessages() {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        if (!this.currentProject) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px;">
                <div style="font-size:48px;margin-bottom:16px;">🚀</div>
                <div style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">欢迎使用 DevHub</div>
                <div style="font-size:14px;color:var(--text-secondary);max-width:360px;line-height:1.6;">
                    点击左侧 <b>+</b> 添加项目，选择项目后即可开始 AI 对话
                </div>
            </div>`;
            return;
        }
        if (!this.currentSession) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px;">
                <div style="font-size:48px;margin-bottom:16px;">💬</div>
                <div style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">选择或新建会话</div>
                <div style="font-size:13px;color:var(--text-secondary);">在左侧会话面板选择已有会话，或点击「新建会话」开始</div>
            </div>`;
            return;
        }
        if (this.messages.length === 0) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px;">
                <div style="font-size:36px;margin-bottom:12px;">✨</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-primary);">开始对话</div>
                <div style="font-size:13px;color:var(--text-secondary);">在下方输入框输入消息，Ctrl+Enter 发送</div>
            </div>`;
            return;
        }

        this.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.role}`;

            // 使用 marked 渲染 Markdown
            let content = message.content;
            if (typeof marked !== 'undefined') {
                content = marked.parse(content);
            }

            // 使用 highlight.js 高亮代码
            if (typeof hljs !== 'undefined') {
                content = content.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                    const highlighted = hljs.highlight(code, { language: lang }).value;
                    return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                });
            }

            messageElement.innerHTML = `
                <div class="message-content">${content}</div>
                <div class="message-time">${message.time || ''}</div>
            `;

            container.appendChild(messageElement);
        });

        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    }

    addTaskOutput(data, type = 'info') {
        const container = document.getElementById('tasks-output');
        const placeholder = container.querySelector('.tasks-placeholder');
        if (placeholder) placeholder.remove();

        if (type === 'stream') {
            if (!this._taskStreamingEl) {
                this._taskStreamingEl = document.createElement('div');
                container.appendChild(this._taskStreamingEl);
            }
            this._taskStreamingEl.textContent += data;
        } else {
            this._taskStreamingEl = null;
            const div = document.createElement('div');
            div.textContent = data;
            container.appendChild(div);
        }

        container.scrollTop = container.scrollHeight;
    }

    async updateTokenDisplay(inputTokens, outputTokens) {
        const sessionElement = document.getElementById("session-tokens");
        const current = parseInt(sessionElement.textContent.replace("会话: ", "")) || 0;
        sessionElement.textContent = "会话: " + (current + inputTokens + outputTokens);

        await this.updateTokenSummary();
        await this.checkBudgetAlert();
    }

    async checkBudgetAlert() {
        if (!this.settings) return;
        try {
            const dailySummary = await window.electronAPI.getTokenSummary("daily");
            const monthlySummary = await window.electronAPI.getTokenSummary("monthly");
            const dailyBudget = this.settings.dailyTokenBudget || 1000000;
            const monthlyBudget = this.settings.monthlyTokenBudget || 10000000;
            const dailyUsed = dailySummary.total_tokens || 0;
            const monthlyUsed = monthlySummary.total_tokens || 0;
            const dailyPercent = dailyBudget > 0 ? (dailyUsed / dailyBudget * 100) : 0;
            const monthlyPercent = monthlyBudget > 0 ? (monthlyUsed / monthlyBudget * 100) : 0;
            const dailyEl = document.getElementById("daily-tokens");
            const monthlyEl = document.getElementById("monthly-tokens");

            if (dailyPercent >= 100) dailyEl.style.color = "var(--danger)";
            else if (dailyPercent >= 80) dailyEl.style.color = "#ff9800";
            else dailyEl.style.color = "";

            if (monthlyPercent >= 100) monthlyEl.style.color = "var(--danger)";
            else if (monthlyPercent >= 80) monthlyEl.style.color = "#ff9800";
            else monthlyEl.style.color = "";

            if (dailyPercent >= 100) {
                this.showBudgetWarning("日 Token 预算已用尽！", dailyUsed, dailyBudget);
            } else if (dailyPercent >= 85 && !this._dailyWarned) {
                this._dailyWarned = true;
                this.showBudgetWarning("日 Token 用量已达 85%", dailyUsed, dailyBudget);
            }

            if (monthlyPercent >= 100) {
                this.showBudgetWarning("月 Token 预算已用尽！", monthlyUsed, monthlyBudget);
            } else if (monthlyPercent >= 85 && !this._monthlyWarned) {
                this._monthlyWarned = true;
                this.showBudgetWarning("月 Token 用量已达 85%", monthlyUsed, monthlyBudget);
            }
        } catch (e) {
            console.error("检查预算失败:", e);
        }
    }

    showBudgetWarning(title, used, budget) {
        const existing = document.querySelector(".budget-warning");
        if (existing) existing.remove();
        const banner = document.createElement("div");
        banner.className = "budget-warning";
        banner.style.cssText = "position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:200;background:var(--danger);color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(255,59,48,0.4);";
        banner.innerHTML = "<span>⚠️ " + title + "</span>" +
            "<span style=\"font-weight:400;font-size:12px;margin:0 8px;\">已用 " + (used/10000).toFixed(0) + "万 / 预算 " + (budget/10000).toFixed(0) + "万</span>" +
            "<button style=\"background:rgba(255,255,255,0.2);border:none;color:#fff;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px;\">✕</button>";
        banner.querySelector("button").addEventListener("click", () => banner.remove());
        document.body.appendChild(banner);
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 10000);
    }

    async updateTokenSummary() {
        try {
            const dailySummary = await window.electronAPI.getTokenSummary('daily');
            const monthlySummary = await window.electronAPI.getTokenSummary('monthly');

            const sessionElement = document.getElementById('session-tokens');
            const sessionTokens = parseInt(sessionElement.textContent.replace('会话: ', '')) || 0;

            document.getElementById('session-tokens').textContent =
                `会话: ${sessionTokens}`;
            document.getElementById('daily-tokens').textContent =
                `今日: ${dailySummary.total_tokens || 0}`;
            document.getElementById('monthly-tokens').textContent =
                `本月: ${monthlySummary.total_tokens || 0}`;
        } catch (error) {
            console.error('更新 Token 汇总失败:', error);
        }
    }

    async saveTokenUsage(inputTokens, outputTokens) {
        if (!this.currentProject || !this.currentSession || inputTokens === 0) return;

        try {
            await window.electronAPI.saveTokenUsage({
                sessionId: this.currentSession.id,
                projectName: this.currentProject.name,
                inputTokens: inputTokens,
                outputTokens: outputTokens
            });
        } catch (error) {
            console.error('保存 Token 用量失败:', error);
        }
    }

    updateSendButton() {
        const sendBtn = document.getElementById('send-btn');
        const stopBtn = document.getElementById('stop-btn');

        if (this.isClaudeRunning) {
            sendBtn.disabled = true;
            stopBtn.style.display = 'flex';
        } else {
            sendBtn.disabled = false;
            stopBtn.style.display = 'none';
        }
    }

    async saveCurrentSession() {
        if (!this.currentProject || !this.currentSession) return;

        const sessionData = {
            name: this.currentSession.name,
            project: this.currentProject.name,
            createdAt: this.currentSession.createdAt,
            messages: this.messages
        };

        try {
            await window.electronAPI.saveSession(this.currentProject.name, this.currentSession.id, sessionData);
        } catch (error) {
            console.error('保存会话失败:', error);
        }
    }

    showSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const overlay = document.getElementById('modal-overlay');

        // 填充当前设置
        if (this.settings) {
            document.getElementById('api-base-url').value = this.settings.apiBaseUrl || '';
            document.getElementById('api-key').value = this.settings.apiKey || '';
            document.getElementById('default-model').value = this.settings.defaultModel || '';
            document.getElementById('daily-token-budget').value = (this.settings.dailyTokenBudget || 1000000) / 10000;
            document.getElementById('monthly-token-budget').value = (this.settings.monthlyTokenBudget || 10000000) / 10000;
        }

        overlay.classList.add('active');
        modal.style.display = 'block';
        this.checkOllama();
        this.loadSystemInfo();
    }

    showProjectModal() {
        const modal = document.getElementById('project-modal');
        const overlay = document.getElementById('modal-overlay');

        // 清空表单
        document.getElementById('project-name').value = '';
        document.getElementById('project-path').value = '';
        document.getElementById('project-model').value = '';

        overlay.classList.add('active');
        modal.style.display = 'block';
    }

    hideModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');

        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showAlert(message, title = '提示') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;

            const okBtn = document.getElementById('confirm-ok-btn');
            okBtn.className = 'action-btn primary';
            okBtn.textContent = '确定';

            const cancelBtn = document.getElementById('confirm-cancel-btn');
            cancelBtn.style.display = 'none';

            const cleanup = () => {
                overlay.classList.remove('active');
                modal.style.display = 'none';
                cancelBtn.style.display = '';
            };

            okBtn.removeEventListener("click", showConfirm._okHandler);
            document.getElementById('confirm-ok-btn').addEventListener('click', () => { cleanup(); resolve(true); });

            overlay.classList.add('active');
            modal.style.display = 'block';
        });
    }

    showConfirm._okHandler = null;
    showConfirm._cancelHandler = null;

    showConfirm(message, title = '确认', danger = true) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;

            const okBtn = document.getElementById('confirm-ok-btn');
            okBtn.className = danger ? 'action-btn danger' : 'action-btn primary';

            const cleanup = () => {
                overlay.classList.remove('active');
                modal.style.display = 'none';
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };
            showConfirm._okHandler = onOk;
            showConfirm._cancelHandler = onCancel;

            // 移除旧监听器（避免重复绑定）
            const newOkBtn = document.getElementById('confirm-ok-btn');
            const newCancelBtn = document.getElementById('confirm-cancel-btn');
            newOkBtn.removeEventListener('click', okHandler);
            newCancelBtn.removeEventListener('click', cancelHandler);
            newOkBtn.addEventListener('click', onOk);
            newCancelBtn.addEventListener('click', onCancel);

            overlay.classList.add('active');
            modal.style.display = 'block';
        });
    }

    showPrompt._okHandler = null;
    showPrompt._cancelHandler = null;

    showPrompt(message, title = '输入', defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');
            const modal = document.getElementById('prompt-modal');
            document.getElementById('prompt-title').textContent = title;
            document.getElementById('prompt-message').textContent = message;
            const input = document.getElementById('prompt-input');
            input.value = defaultValue;

            const cleanup = () => {
                overlay.classList.remove('active');
                modal.style.display = 'none';
            };

            const onOk = () => { cleanup(); resolve(input.value.trim()); };
            const onCancel = () => { cleanup(); resolve(null); };

            const okBtn = document.getElementById('prompt-ok-btn');
            okBtn.removeEventListener("click", showConfirm._okHandler);
            const cancelBtn = document.getElementById('prompt-cancel-btn');
            cancelBtn.removeEventListener("click", showConfirm._cancelHandler);

            document.getElementById('prompt-ok-btn').addEventListener('click', onOk);
            document.getElementById('prompt-cancel-btn').addEventListener('click', onCancel);

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') onOk();
                if (e.key === 'Escape') onCancel();
            });

            overlay.classList.add('active');
            modal.style.display = 'block';
            input.focus();
            input.select();
        });
    }

    async saveSettings() {
        const settings = {
            apiBaseUrl: document.getElementById('api-base-url').value,
            apiKey: document.getElementById('api-key').value,
            defaultModel: document.getElementById('default-model').value,
            dailyTokenBudget: parseInt(document.getElementById('daily-token-budget').value) * 10000,
            monthlyTokenBudget: parseInt(document.getElementById('monthly-token-budget').value) * 10000,
            theme: this.settings?.theme || 'light',
            lastSelectedModel: this.settings?.lastSelectedModel ?? null
        };

        try {
            await window.electronAPI.saveSettings(settings);
            this.settings = settings;
            this.updateTheme();
            this.hideModal();
        } catch (error) {
            console.error('保存设置失败:', error);
            await this.showAlert('保存设置失败: ' + error.message);
        }
    }

    async saveProject() {
        const name = document.getElementById('project-name').value.trim();
        const path = document.getElementById('project-path').value.trim();
        const defaultModel = document.getElementById('project-model').value.trim();

        if (!name) {
            await this.showAlert('请输入项目名称');
            return;
        }

        if (!path) {
            await this.showAlert('请选择项目路径');
            return;
        }

        const project = {
            name,
            path,
            defaultModel: defaultModel || null,
            createdAt: new Date().toISOString()
        };

        // 检查是否已存在
        if (this.projects.some(p => p.name === name)) {
            await this.showAlert('项目名称已存在');
            return;
        }

        this.projects.push(project);

        try {
            await window.electronAPI.saveProjects(this.projects);
            this.updateProjectSelect();
            this.updateProjectList();
            this.hideModal();

            // 自动选择新项目
            await this.selectProject(name);
        } catch (error) {
            console.error('保存项目失败:', error);
            await this.showAlert('保存项目失败: ' + error.message);
        }
    }

    async loadSkills() {
        const container = document.getElementById('skills-list');
        if (!this.currentProject) {
            container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">请先在顶部选择项目</div>';
            return;
        }

        const skillsPath = `${this.currentProject.path}/.claude/skills`;
        container.innerHTML = '<div class="loading" style="padding:32px;text-align:center;color:var(--text-secondary);">加载中...</div>';

        try {
            const skills = await window.electronAPI.readDir(skillsPath);
            container.innerHTML = '';
            if (skills.length === 0) {
                container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">暂无 Skills<br><span style="font-size:12px;">在项目 .claude/skills/ 目录下创建 .md 文件</span></div>';
                return;
            }
            skills.forEach(skill => {
                this.createSkillItem(skill);
            });
        } catch (error) {
            container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">Skills 目录尚未创建<br><span style="font-size:12px;">点击上方 + 按钮创建第一个 Skill</span></div>';
        }
    }

    async loadAgents() {
        const container = document.getElementById('agents-list');
        if (!this.currentProject) {
            container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">请先在顶部选择项目</div>';
            return;
        }

        const agentsPath = `${this.currentProject.path}/.claude/agents`;
        container.innerHTML = '<div class="loading" style="padding:32px;text-align:center;color:var(--text-secondary);">加载中...</div>';

        try {
            const agents = await window.electronAPI.readDir(agentsPath);
            container.innerHTML = '';
            if (agents.length === 0) {
                container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">暂无 Agents<br><span style="font-size:12px;">在项目 .claude/agents/ 目录下创建 .md 文件</span></div>';
                return;
            }
            agents.forEach(agent => {
                this.createAgentItem(agent);
            });
        } catch (error) {
            container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">Agents 目录尚未创建<br><span style="font-size:12px;">点击上方 + 按钮创建第一个 Agent</span></div>';
        }
    }

    async createSkill() {
        if (!this.currentProject) return;

        const name = await this.showPrompt('请输入 Skill 名称（不含 .md 后缀）：', '新建 Skill');
        if (!name) return;

        const skillsDir = this.currentProject.path + '/.claude/skills';
        const skillPath = skillsDir + '/' + name + '.md';
        const template = '# ' + name + '\n\n## 描述\n\n## 规则\n';

        try {
            await window.electronAPI.mkdir(skillsDir);
            await window.electronAPI.writeFile(skillPath, template);
            this.loadSkills();
        } catch (e) {
            await this.showAlert('创建失败: ' + e.message);
        }
    }

    async createAgent() {
        if (!this.currentProject) return;

        const name = await this.showPrompt('请输入 Agent 名称（不含 .md 后缀）：', '新建 Agent');
        if (!name) return;

        const agentsDir = this.currentProject.path + '/.claude/agents';
        const agentPath = agentsDir + '/' + name + '.md';
        const template = '# ' + name + '\n\n## 角色\n\n## 指令\n';

        try {
            await window.electronAPI.mkdir(agentsDir);
            await window.electronAPI.writeFile(agentPath, template);
            this.loadAgents();
        } catch (e) {
            await this.showAlert('创建失败: ' + e.message);
        }
    }

    createSkillItem(skill) {
        const container = document.getElementById('skills-list');

        const item = document.createElement('div');
        item.className = 'skill-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${skill.name.replace('.md', '')}</h4>
                <p>${skill.path}</p>
            </div>
            <div class="item-actions">
                <button class="icon-btn edit-skill" title="编辑">✏️</button>
                <button class="icon-btn delete-skill" title="删除">🗑️</button>
            </div>
        `;

        // 编辑：用系统编辑器打开
        item.querySelector('.edit-skill').addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await window.electronAPI.openFile(skill.path);
            } catch (err) {
                await this.showAlert('打开文件失败: ' + err.message);
            }
        });

        // 删除
        item.querySelector('.delete-skill').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!await this.showConfirm(`确定删除 Skill "${skill.name.replace('.md', '')}" 吗？`, '删除 Skill')) return;
            try {
                await window.electronAPI.deleteFile(skill.path);
                this.loadSkills();
            } catch (err) {
                await this.showAlert('删除失败: ' + err.message);
            }
        });

        container.appendChild(item);
    }

    createAgentItem(agent) {
        const container = document.getElementById('agents-list');

        const item = document.createElement('div');
        item.className = 'agent-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${agent.name.replace('.md', '')}</h4>
                <p>${agent.path}</p>
            </div>
            <div class="item-actions">
                <button class="icon-btn edit-agent" title="编辑">✏️</button>
                <button class="icon-btn delete-agent" title="删除">🗑️</button>
            </div>
        `;

        // 编辑：用系统编辑器打开
        item.querySelector('.edit-agent').addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await window.electronAPI.openFile(agent.path);
            } catch (err) {
                await this.showAlert('打开文件失败: ' + err.message);
            }
        });

        // 删除
        item.querySelector('.delete-agent').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!await this.showConfirm(`确定删除 Agent "${agent.name.replace('.md', '')}" 吗？`, '删除 Agent')) return;
            try {
                await window.electronAPI.deleteFile(agent.path);
                this.loadAgents();
            } catch (err) {
                await this.showAlert('删除失败: ' + err.message);
            }
        });

        container.appendChild(item);
    }

    async loadTokenUsage() {
        try {
            const period = document.getElementById('tokens-period').value;
            const projectName = this.currentProject?.name;

            const usageData = await window.electronAPI.getTokenUsage(period, projectName);
            this.updateTokenTable(usageData);
            this.updateTokenChart(usageData, period);
        } catch (error) {
            console.error('加载 Token 用量失败:', error);
        }
    }

    updateTokenTable(usageData) {
        const tbody = document.getElementById('tokens-table-body');
        tbody.innerHTML = '';

        if (usageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:32px;text-align:center;color:var(--text-secondary);">暂无数据</td></tr>';
            return;
        }

        usageData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.date || row.month || 'N/A'}</td>
                <td>${row.project_name || '所有项目'}</td>
                <td>${row.input_tokens || 0}</td>
                <td>${row.output_tokens || 0}</td>
                <td>${row.total_tokens || 0}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateTokenChart(usageData, period) {
        const canvas = document.getElementById('tokens-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (usageData.length === 0) {
            // 显示无数据消息
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
            return;
        }

        // 简单绘制柱状图
        const maxValue = Math.max(...usageData.map(row => row.total_tokens || 0));
        const barWidth = canvas.width / (usageData.length * 1.5);
        const padding = 50;
        const chartHeight = canvas.height - padding * 2;

        // 绘制坐标轴
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.strokeStyle = '#666';
        ctx.stroke();

        // 绘制数据
        usageData.forEach((row, index) => {
            const x = padding + index * (barWidth + 10);
            const value = row.total_tokens || 0;
            const barHeight = (value / maxValue) * chartHeight;
            const y = canvas.height - padding - barHeight;

            // 绘制柱状图
            ctx.fillStyle = '#007acc';
            ctx.fillRect(x, y, barWidth, barHeight);

            // 绘制标签
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                row.date ? row.date.split('-').slice(1).join('-') : (row.month || ''),
                x + barWidth / 2,
                canvas.height - padding + 20
            );

            // 绘制数值
            ctx.fillText(
                value.toString(),
                x + barWidth / 2,
                y - 5
            );
        });
    }

    async refreshPluginList() {
        const results = await window.scanAllPlugins();
        this.pluginStatus = results;
        const container = document.getElementById('plugin-list');
        if (!container) return;
        container.innerHTML = '';
        results.forEach(p => {
            const item = document.createElement('div');
            item.className = 'nav-item';
            item.innerHTML = `<span>${p.online ? '🟢' : '🔴'}</span> ${p.icon} ${p.name}`;
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => this.switchTab('plugins'));
            container.appendChild(item);
        });
    }

    async checkPlugins() {
        await this.refreshPluginList();
        // NovelCraft integration: activate if port 9020 is online
        if (typeof NovelCraftIntegration !== "undefined") {
            this.novelcraft = new NovelCraftIntegration(this);
            const ncOnline = await this.novelcraft.healthCheck();
            if (ncOnline) {
                this.novelcraft.initUI();
                console.log("[DevHub] NovelCraft integration activated");
            }
        }
        setInterval(() => this.refreshPluginList(), 30000);
    }
        }
        plugins.forEach(p => {
            const item = document.createElement('div');
            item.className = 'skill-item';
            item.innerHTML = `
                <div class="item-info">
                    <h4>${p.icon} ${p.name} <span>${p.online ? '🟢 在线' : '🔴 离线'}</span></h4>
                    <p>端口: ${p.port} | ${p.description}</p>
                </div>
                <div class="item-actions">
                    <button class="icon-btn refresh-plugin" data-id="${p.id}" title="刷新">🔄</button>
                </div>
            `;
            item.querySelector('.refresh-plugin').addEventListener('click', async (e) => {
                e.stopPropagation();
                const btn = e.target;
                btn.textContent = '⏳';
                const result = await window.scanPlugin(p.id);
                if (result) {
                    const idx = this.pluginStatus.findIndex(x => x.id === p.id);
                    if (idx >= 0) this.pluginStatus[idx] = result;
                    this.showPluginManagement();
                }
                btn.textContent = '🔄';
            });
            container.appendChild(item);
        });
    }

    async loadSystemInfo() {
        try {
            const mem = await window.electronAPI.getSystemMemory();
            const totalGB = (mem.total / (1024 * 1024 * 1024)).toFixed(1);
            const freeGB = (mem.free / (1024 * 1024 * 1024)).toFixed(1);
            const usedPercent = ((mem.total - mem.free) / mem.total * 100).toFixed(1);
            const el = document.getElementById('system-info');
            if (el) {
                el.innerHTML = `总内存: ${totalGB} GB | 可用: ${freeGB} GB | 已用: ${usedPercent}%`;
            }
        } catch (e) {
            const el = document.getElementById('system-info');
            if (el) el.textContent = '无法获取系统信息';
        }
    }

    async checkOllama() {
        const MODEL_TAGS = {
            'cloud': ['推理能力强', '逻辑严密'],
            'qwen': ['中英双语', '综合能力强'],
            'llama': ['通用能力强', '社区活跃'],
            'codellama': ['代码生成', '多语言支持'],
            'mistral': ['轻量高效', '响应快速'],
            'gemma': ['轻量级', '适合端侧'],
            'phi': ['小而精', '高效推理'],
            'mixtral': ['混合专家', '性能优异'],
            'qwen3': ['最新通义千问', '推理与对话'],
            'llama3.1': ['Meta 旗舰', '128K 上下文']
        };

        const getTags = (name) => {
            const tags = [];
            const lowerName = name.toLowerCase();
            for (const [key, value] of Object.entries(MODEL_TAGS)) {
                if (lowerName.includes(key)) {
                    tags.push(...value);
                }
            }
            return tags;
        };

        const formatSize = (bytes) => {
            if (!bytes) return '';
            const gb = bytes / (1024 * 1024 * 1024);
            if (gb >= 5) return '大模型';
            if (gb < 2) return '轻量';
            return '';
        };

        const result = await window.checkOllamaStatus({ force: true });
        const mem = await window.electronAPI.getSystemMemory();
        const safeLimit = mem.free * 0.7;
        const indicator = document.getElementById('ollama-indicator');
        const statusText = document.getElementById('ollama-status-text');
        const installedSelect = document.getElementById('ollama-installed-select');
        const availableList = document.getElementById('ollama-available-list');
        const modelSelect = document.getElementById('model-select');

        const buildModelOption = (m) => {
            const sizeGB = m.size ? (m.size / (1024 * 1024 * 1024)).toFixed(1) : '';
            const sizeTag = formatSize(m.size);
            const labels = [];
            let disabled = false;
            const GB = 1024 * 1024 * 1024;
            if (m.size > 8 * GB) {
                disabled = true;
                labels.push('(硬件要求极高 / Extreme HW requirement)');
            }
            if (m.size > safeLimit) {
                disabled = true;
                labels.push('(内存不足 / Insufficient RAM)');
            }
            if (m.size > 4 * GB) {
                labels.push('(硬件要求高 / High HW requirement)');
            }
            const sizeDisplay = sizeGB ? sizeGB + ' GB' : '';
            const labelSuffix = labels.length ? ' ' + labels.join(' ') : '';
            return { sizeDisplay, sizeTag, disabled, labelSuffix };
        };

        if (result.online) {
            indicator.textContent = '🟢';
            statusText.textContent = '在线';

            installedSelect.innerHTML = '<option value="">选择已安装模型...</option>';
            if (result.installed && result.installed.length > 0) {
                result.installed.forEach(m => {
                    const { sizeDisplay, sizeTag, disabled, labelSuffix } = buildModelOption(m);
                    const id = m.name.startsWith('ollama:') ? m.name : ('ollama:' + m.name);
                    const bare = id.replace(/^ollama:/, '');
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = `${bare} ${sizeDisplay} ${sizeTag}${labelSuffix}`.trim();
                    option.disabled = disabled;
                    installedSelect.appendChild(option);
                });
                await this.appendOllamaModelOptions(modelSelect, result);
            } else {
                installedSelect.innerHTML = '<option value="">暂无已安装模型</option>';
            }

            // 可下载模型
            if (result.available && result.available.length > 0) {
                availableList.innerHTML = result.available.map(m => {
                    const tags = getTags(m.name);
                    const sizeTag = formatSize(m.size);
                    const allTags = [...tags, sizeTag].filter(Boolean).join(' ');
                    return `<div class="ollama-model-item" style="padding:6px 0;border-bottom:1px solid var(--border-color);">
                        <div>📦 ${m.name}</div>
                        <div style="color:var(--text-secondary);margin-top:2px;">${allTags}</div>
                        <button class="action-btn secondary" style="margin-top:4px;padding:4px 8px;font-size:11px;" onclick="window.app.downloadOllamaModel('${m.name}')">下载</button>
                    </div>`;
                }).join('');
            } else {
                availableList.innerHTML = '<div style="color:var(--text-secondary);padding:4px 0;">输入模型名手动下载</div>';
            }
        } else {
            indicator.textContent = '🔴';
            statusText.textContent = '离线';
            installedSelect.innerHTML = '<option value="">无 Ollama</option>';
            availableList.innerHTML = '<div style="color:var(--text-secondary);">请启动 Ollama 后重试</div>';
        }

        await this.updateModelSelect();
    }

    async downloadOllamaModel(modelName) {
        if (!modelName) {
            modelName = document.getElementById('ollama-model-name').value.trim();
        }
        if (!modelName) {
            await this.showAlert('请输入模型名称');
            return;
        }

        const statusText = document.getElementById('ollama-status-text');
        statusText.textContent = '正在下载...';

        try {
            const response = await fetch('http://127.0.0.1:11434/api/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName })
            });

            if (!response.ok) throw new Error('下载失败');

            // 读取流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                try {
                    const data = JSON.parse(chunk);
                    if (data.status) {
                        statusText.textContent = '下载中: ' + (data.progress || data.status);
                    }
                } catch (e) {}
            }

            statusText.textContent = '下载完成';
            await this.checkOllama();
        } catch (e) {
            statusText.textContent = '下载失败';
            await this.showAlert('下载失败: ' + e.message);
        }
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DevHubApp();
});
