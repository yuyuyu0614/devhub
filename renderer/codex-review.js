/**
 * Codex-Review - 浜戠娣卞害浠ｇ爜瀹℃煡宸ュ叿
 * 浣跨敤 cloud API 杩涜娣卞害浠ｇ爜瀹℃煡
 * 涓庢湰鍦?Gito 褰㈡垚"鏃ュ父妫€鏌?+ 娣卞害瀹℃煡"鍗忎綔妯″紡
 * 鍙€夐泦鎴?Reviewdog 杩涜 lint 琛ュ厖
 */
class CodexReview {
  constructor(electronAPI) {
    this.api = electronAPI;
    this.isReviewing = false;
    this.defaultModel = 'your-model-name';
    this.reviewHistory = [];
  }

  /**
   * 鎵ц浜戠娣卞害浠ｇ爜瀹℃煡
   * @param {string} diffContent - git diff 鍐呭
   * @param {object} options
   */
  async review(diffContent, options = {}) {
    if (!diffContent || diffContent.trim() === '') {
      throw new Error('娌℃湁鍙鏌ョ殑浠ｇ爜鍙樻洿');
    }

    this.isReviewing = true;

    try {
      const result = await this.api.codeReview({
        diffContent,
        model: options.model || this.defaultModel,
        reviewStyle: options.reviewStyle || 'deep',
        backend: 'cloud',
        language: options.language || ''
      });

      // 璁板綍瀹℃煡鍘嗗彶
      this.reviewHistory.push({
        timestamp: new Date().toISOString(),
        model: options.model || this.defaultModel,
        style: options.reviewStyle || 'deep',
        diffSize: diffContent.length,
        resultSize: (result.result || '').length
      });

      if (options.onDone) options.onDone(result);
      return result;
    } finally {
      this.isReviewing = false;
    }
  }

  /**
   * 瀵规殏瀛樺尯杩涜娣卞害瀹℃煡锛堟彁浜ゅ墠瀹℃煡锛?   */
  async reviewStaged(projectPath, options = {}) {
    const diff = await this.api.gitDiff(projectPath, true);
    if (!diff) throw new Error('鏆傚瓨鍖烘病鏈夊彉鏇?);
    return this.review(diff, { ...options, reviewStyle: 'deep' });
  }

  /**
   * 瀵瑰伐浣滃尯杩涜蹇€熷鏌?   */
  async reviewWorkspace(projectPath, options = {}) {
    const diff = await this.api.gitDiff(projectPath, false);
    if (!diff) throw new Error('宸ヤ綔鍖烘病鏈夊彉鏇?);
    return this.review(diff, { ...options, reviewStyle: 'quick' });
  }

  /**
   * 瀹夊叏瀹¤妯″紡
   */
  async securityAudit(projectPath, options = {}) {
    const diff = await this.api.gitDiff(projectPath, false);
    if (!diff) throw new Error('宸ヤ綔鍖烘病鏈夊彉鏇?);
    return this.review(diff, { ...options, reviewStyle: 'security' });
  }

  /**
   * 瑙ｆ瀽瀹℃煡缁撴灉锛屾彁鍙栫粨鏋勫寲璇勫垎
   */
  parseResult(reviewText) {
    const parsed = {
      score: null,
      summary: '',
      findings: [],
      sections: {}
    };

    // 灏濊瘯鎻愬彇璇勫垎
    const scoreMatch = reviewText.match(/璇勫垎[锛?]\s*(\d+)[\/\s]*10/);
    if (scoreMatch) parsed.score = parseInt(scoreMatch[1]);

    // 鍒嗗壊鍚勪釜缁村害
    const sections = reviewText.split(/\d+\.\s*[馃敶馃煛馃煝馃摑]/);
    const headers = reviewText.match(/\d+\.\s*([馃敶馃煛馃煝馃摑][^\n]+)/g);
    if (headers) {
      headers.forEach((header, i) => {
        const key = header.replace(/^\d+\.\s*/, '').trim();
        parsed.sections[key] = (sections[i + 1] || '').trim();
      });
    }

    // 鎻愬彇鎬荤粨
    const summaryMatch = reviewText.match(/鎬讳綋璇勪环[锛?]\s*(.+)/);
    if (summaryMatch) parsed.summary = summaryMatch[1].trim();

    return parsed;
  }

  /**
   * 鑾峰彇瀹℃煡鍘嗗彶
   */
  getHistory() {
    return this.reviewHistory;
  }

  /**
   * 杩愯 Reviewdog锛堝彲閫夎ˉ鍏咃級
   * 闇€瑕佸湪绯荤粺涓婂畨瑁?reviewdog: choco install reviewdog (Windows) / brew install reviewdog (Mac)
   */
  async runReviewdog(projectPath) {
    return this.api.runReviewdog(projectPath);
  }

  stop() {
    this.isReviewing = false;
    return this.api.stopReview();
  }
}

if (typeof window !== 'undefined') {
  window.CodexReview = CodexReview;
}
