/**
 * Gito - 鏈湴浠ｇ爜瀹℃煡宸ュ叿锛圖evHub 榛樿瀹℃煡寮曟搸锛? * 浣跨敤 Ollama 鏈湴妯″瀷瀹炵幇闆舵垚鏈唬鐮佸鏌? *
 * 璁捐瀹氫綅锛氭棩甯稿揩閫熸鏌ワ紝绉掔骇鍝嶅簲锛岄浂鎴愭湰
 * 涓?Codex-Review锛堜簯绔繁搴﹀鏌ワ級浜掕ˉ鍗忎綔
 */
class GitoReview {
  constructor(electronAPI) {
    this.api = electronAPI;
    this.isReviewing = false;
    this.defaultModel = 'qwen3-coder:30b';
    this.ollamaBaseUrl = 'http://127.0.0.1:11434';
    this._modelCache = null;
    this._cacheTime = 0;
  }

  /**
   * 鑾峰彇宸插畨瑁呯殑 Ollama 妯″瀷鍒楄〃锛?0 绉掔紦瀛橈級
   */
  async _getInstalledModels(force = false) {
    const now = Date.now();
    if (!force && this._modelCache && now - this._cacheTime < 30000) {
      return this._modelCache;
    }
    try {
      const resp = await fetch(this.ollamaBaseUrl + '/api/tags', {
        signal: AbortSignal.timeout(3000)
      });
      const data = await resp.json();
      this._modelCache = (data.models || []).map(m =>
        String(m.model || m.name || '').replace(/^ollama:/, '')
      );
      this._cacheTime = now;
      return this._modelCache;
    } catch {
      return this._modelCache || [];
    }
  }

  /**
   * 閫夊彇鏈€浣冲彲鐢ㄤ唬鐮佸鏌ユā鍨?   * 浼樺厛绾э細qwen3-coder > qwen3-coder > codellama > qwen3 > qwen2.5-coder > 鍏朵粬
   */
  async detectBestModel() {
    const models = await this._getInstalledModels();
    if (models.length === 0) return this.defaultModel;

    const preference = [
      'qwen3-coder', 'qwen3-coder', 'codellama',
      'qwen3', 'qwen2.5-coder', 'qwen', 'mistral', 'llama'
    ];
    for (const pref of preference) {
      const match = models.find(m => m.toLowerCase().includes(pref));
      if (match) return match;
    }
    return models[0];
  }

  /**
   * 鍋ュ悍妫€鏌ワ細Ollama 鏄惁鍦ㄧ嚎 & 鐩爣妯″瀷鏄惁鍙敤
   * 杩斿洖 { ok: boolean, model: string, message?: string }
   */
  async healthCheck() {
    try {
      const resp = await fetch(this.ollamaBaseUrl + '/api/tags', {
        signal: AbortSignal.timeout(3000)
      });
      if (!resp.ok) {
        return { ok: false, model: null, message: 'Ollama 鏈嶅姟鍝嶅簲寮傚父锛岃妫€鏌ユ槸鍚︽甯歌繍琛?(ollama serve)' };
      }
      const data = await resp.json();
      const installed = (data.models || []).map(m =>
        String(m.model || m.name || '').replace(/^ollama:/, '')
      );

      if (installed.length === 0) {
        return { ok: false, model: null, message: 'Ollama 鍦ㄧ嚎浣嗘湭瀹夎浠讳綍妯″瀷銆傝杩愯: ollama pull qwen3-coder:30b' };
      }

      const bestModel = await this.detectBestModel();
      const modelExists = installed.some(m => m === bestModel || m.includes(bestModel));
      if (!modelExists) {
        return {
          ok: true,
          model: installed[0],
          message: `鎺ㄨ崘妯″瀷 ${bestModel} 鏈畨瑁咃紝灏嗕娇鐢?${installed[0]}銆傚缓璁? ollama pull qwen3-coder:30b`
        };
      }

      return { ok: true, model: bestModel };
    } catch {
      return { ok: false, model: null, message: '鏃犳硶杩炴帴 Ollama 鏈嶅姟 (http://127.0.0.1:11434)銆傝纭 Ollama 宸插惎鍔? ollama serve' };
    }
  }

  /**
   * 鎵ц鏈湴浠ｇ爜瀹℃煡
   */
  async review(diffContent, options = {}) {
    if (!diffContent || diffContent.trim() === '') {
      throw new Error('娌℃湁鍙鏌ョ殑浠ｇ爜鍙樻洿');
    }

    // 棰勬
    const health = await this.healthCheck();
    if (!health.ok) {
      throw new Error(health.message);
    }

    const model = options.model || health.model || this.defaultModel;
    const ollamaModel = model.startsWith('ollama:') ? model.replace('ollama:', '') : model;

    this.isReviewing = true;

    try {
      const result = await this.api.codeReview({
        diffContent,
        model: ollamaModel,
        reviewStyle: options.reviewStyle || 'quick',
        backend: 'ollama',
        language: options.language || ''
      });

      if (options.onDone) options.onDone(result);
      return result;
    } finally {
      this.isReviewing = false;
    }
  }

  /**
   * 鑾峰彇宸ヤ綔鍖哄彉鏇村苟瀹℃煡
   */
  async reviewWorkspace(projectPath, options = {}) {
    const diff = await this.api.gitDiff(projectPath, false);
    if (!diff) throw new Error('宸ヤ綔鍖烘病鏈夊彉鏇?鈥?浠ｇ爜宸叉槸鏈€鏂扮姸鎬?);
    return this.review(diff, options);
  }

  /**
   * 鑾峰彇鏆傚瓨鍖哄彉鏇村苟瀹℃煡
   */
  async reviewStaged(projectPath, options = {}) {
    const diff = await this.api.gitDiff(projectPath, true);
    if (!diff) throw new Error('鏆傚瓨鍖烘病鏈夊彉鏇?鈥?璇峰厛 git add 闇€瑕佸鏌ョ殑鏂囦欢');
    return this.review(diff, options);
  }

  /**
   * 瑙ｆ瀽瀹℃煡缁撴灉锛屾彁鍙栫粨鏋勫寲闂鍒楄〃
   */
  parseFindings(reviewText) {
    const findings = [];
    const lines = reviewText.split('\n');
    const severityMap = {
      '馃敶': 'critical',
      '馃煛': 'medium',
      '馃煝': 'suggestion'
    };

    let currentFinding = null;

    for (const line of lines) {
      const severityMatch = line.match(/([馃敶馃煛馃煝])\s*(.+)/);
      if (severityMatch) {
        if (currentFinding) findings.push(currentFinding);
        currentFinding = {
          severity: severityMap[severityMatch[1]] || 'info',
          icon: severityMatch[1],
          title: severityMatch[2].trim(),
          details: []
        };
      } else if (currentFinding && line.trim()) {
        currentFinding.details.push(line.trim());
      }
    }
    if (currentFinding) findings.push(currentFinding);

    return findings;
  }

  stop() {
    this.isReviewing = false;
    return this.api.stopReview();
  }
}

if (typeof window !== 'undefined') {
  window.GitoReview = GitoReview;
}
