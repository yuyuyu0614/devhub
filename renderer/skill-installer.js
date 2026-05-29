// ========== DevHub Skill 安装器 ==========
// 从 GitHub 下载并安装官方 Skill 包

(function () {
  'use strict';

  const REGISTRY_URL = 'https://raw.githubusercontent.com/yuyuyu0614/devhub/main/renderer/skill-registry.json';
  const LOCAL_REGISTRY = 'skill-registry.json';

  let registryCache = null;
  let cacheTime = 0;
  const CACHE_TTL = 600000; // 10 分钟

  /**
   * 获取 Skill 注册表（优先本地，10 分钟后尝试在线更新）
   */
  async function fetchRegistry() {
    if (registryCache && (Date.now() - cacheTime < CACHE_TTL)) {
      return registryCache;
    }

    // 先加载本地版本（保证离线可用）
    try {
      const resp = await fetch(LOCAL_REGISTRY);
      if (resp.ok) {
        registryCache = await resp.json();
        cacheTime = Date.now();
      }
    } catch (e) {
      console.warn('[SkillInstaller] 本地注册表加载失败:', e.message);
    }

    // 尝试在线更新
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(REGISTRY_URL, { signal: controller.signal, cache: 'no-cache' });
      if (resp.ok) {
        const remote = await resp.json();
        if (remote && remote.skills) {
          registryCache = remote;
          cacheTime = Date.now();
        }
      }
    } catch (e) {
      // 在线更新失败，使用本地缓存（静默）
    }

    return registryCache;
  }

  /**
   * 下载单个 Skill zip 并安装到项目 .claude/skills/ 目录
   * @param {Object} skill - skill 定义对象
   * @param {string} projectPath - 目标项目路径
   * @param {Function} onProgress - 进度回调 (status, percent)
   */
  async function installSkill(skill, projectPath, onProgress) {
    onProgress?.('connecting', 0);

    // 1. 确保目标目录存在
    const installDir = projectPath.replace(/\\/g, '/').replace(/\/$/, '') + '/' + skill.installPath;

    // 2. 下载 zip
    let zipData = null;
    const urls = [skill.downloadUrl, skill.fallbackUrl];
    for (const url of urls) {
      try {
        onProgress?.('downloading', 10);
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) continue;

        const contentLength = resp.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength) : skill.size;
        let loaded = 0;

        const reader = resp.body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          const pct = 10 + Math.round((loaded / total) * 60);
          onProgress?.('downloading', pct);
        }
        zipData = new Uint8Array(loaded);
        let pos = 0;
        for (const chunk of chunks) {
          zipData.set(chunk, pos);
          pos += chunk.length;
        }
        break;
      } catch (e) {
        console.warn(`[SkillInstaller] 尝试 ${url} 失败:`, e.message);
      }
    }

    if (!zipData) {
      throw new Error('所有下载源均不可用，请检查网络连接');
    }

    // 3. 解压
    onProgress?.('extracting', 75);
    const files = unzipSync(zipData);

    // 4. 写入文件
    onProgress?.('writing', 85);
    const fileList = [];
    for (const [relativePath, content] of Object.entries(files)) {
      if (relativePath.endsWith('/')) continue; // skip dirs
      const fullPath = installDir + '/' + relativePath;
      fileList.push(fullPath);
    }

    // 通过主进程写入（确保目录创建和文件写入）
    await window.electronAPI.extractZip({
      data: Array.from(zipData),
      targetDir: installDir
    });

    onProgress?.('done', 100);
    return { installDir, fileCount: fileList.length };
  }

  /**
   * 简单的 ZIP 解压（仅用于列出文件，实际写入由主进程完成）
   */
  function unzipSync(data) {
    const files = {};
    let pos = 0;

    while (pos < data.length - 4) {
      // 查找 local file header signature
      const sig = (data[pos] | (data[pos+1] << 8) | (data[pos+2] << 16) | (data[pos+3] << 24)) >>> 0;
      if (sig !== 0x04034b50) {
        pos++;
        continue;
      }

      const compression = data[pos+8] | (data[pos+9] << 8);
      const compressedSize = data[pos+18] | (data[pos+19] << 8) | (data[pos+20] << 16) | (data[pos+21] << 24);
      const fileNameLen = data[pos+26] | (data[pos+27] << 8);
      const extraLen = data[pos+28] | (data[pos+29] << 8);

      const fileName = new TextDecoder().decode(data.slice(pos+30, pos+30+fileNameLen));
      const fileDataStart = pos + 30 + fileNameLen + extraLen;

      if (compression === 0 && compressedSize > 0) {
        files[fileName] = data.slice(fileDataStart, fileDataStart + compressedSize);
      }

      pos = fileDataStart + compressedSize;
    }

    return files;
  }

  /**
   * 检查 Skill 是否已安装
   */
  async function isSkillInstalled(skill, projectPath) {
    const installDir = projectPath.replace(/\\/g, '/').replace(/\/$/, '') + '/' + skill.installPath;
    try {
      await window.electronAPI.readDir(installDir);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 暴露到全局
  window.SkillInstaller = {
    fetchRegistry,
    installSkill,
    isSkillInstalled
  };
})();
