/**
 * NovelCraft Integration — DevHub plugin for novel writing assistance.
 * Loaded conditionally: if NovelCraft server (port 9020) is online.
 * All NovelCraft-specific UI and API calls live here, not in app.js.
 */

class NovelCraftIntegration {
  constructor(app) {
    this.app = app;  // reference to DevHubApp for alert/modal helpers
    this.currentArticleId = null;
    this.baseUrl = 'http://127.0.0.1:9020';
  }

  async healthCheck() {
    try {
      const resp = await fetch(this.baseUrl + '/api/articles/list', {
        signal: AbortSignal.timeout(3000)
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  initUI() {
    const ctxBtn = document.getElementById('context-btn');
    const skillsBtn = document.getElementById('skills-btn-inline');
    const closeBtn = document.getElementById('inline-panel-close');

    if (ctxBtn) ctxBtn.style.display = '';
    if (skillsBtn) skillsBtn.style.display = '';
  }

  async fetchArticleList() {
    try {
      const response = await fetch(this.baseUrl + '/api/articles/list');
      const articles = await response.json();
      console.log('fetchArticleList 获取到文章:', articles.length, '篇');

      if (!articles || articles.length === 0) {
        this._renderPanel('选择文章', []);
        return;
      }

      const items = articles.map(a => ({
        label: a.title || 'Untitled',
        action: () => this.selectArticle(a.id)
      }));
      this._renderPanel('选择文章', items);
    } catch (error) {
      console.error('fetchArticleList 出错:', error);
      if (this.app.showAlert) {
        await this.app.showAlert('无法连接 NovelCraft，请确认服务已启动');
      }
    }
  }

  async selectArticle(articleId) {
    this.currentArticleId = articleId;
    try {
      const response = await fetch(this.baseUrl + '/api/context/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId })
      });
      const ctx = await response.json();
      const label = document.getElementById('context-label');
      const status = document.getElementById('context-status');
      if (label) label.textContent = ctx.title || articleId;
      if (status) status.style.display = '';
    } catch (e) {
      console.error('selectArticle error:', e);
    }
  }

  fetchSkills() {
    if (!this.currentArticleId) {
      this.fetchArticleList();
      return;
    }
    this._renderPanel('选择技能', [
      { label: '开篇大师', action: () => this.applySkill('开篇大师') },
      { label: '对话打磨', action: () => this.applySkill('对话打磨') },
      { label: '节奏诊断', action: () => this.applySkill('节奏诊断') }
    ]);
  }

  async applySkill(skillName) {
    try {
      const response = await fetch(this.baseUrl + '/api/skill/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: this.currentArticleId, skill_name: skillName })
      });
      const result = await response.json();
      console.log('applySkill result:', result);
    } catch (e) {
      console.error('applySkill error:', e);
    }
  }

  // — private —

  _renderPanel(title, items) {
    const panel = document.getElementById('inline-panel');
    const titleEl = document.getElementById('inline-panel-title');
    const body = document.getElementById('inline-panel-body');

    if (!panel || !titleEl || !body) {
      console.error('renderInlinePanel: 缺少 DOM 元素', { panel: !!panel, titleEl: !!titleEl, body: !!body });
      return;
    }

    titleEl.textContent = title;
    body.innerHTML = '';

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'inline-panel-item';
      div.textContent = item.label;
      div.addEventListener('click', item.action);
      body.appendChild(div);
    });

    panel.style.display = '';
  }
}

if (typeof window !== 'undefined') {
  window.NovelCraftIntegration = NovelCraftIntegration;
}
