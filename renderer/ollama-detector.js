// Ollama Hub 检测器：统一返回带 ollama: 前缀的模型 id，并缓存最近一次成功结果
const OLLAMA_STATUS_TTL_MS = 30000;
let ollamaStatusCache = null;
let ollamaStatusCacheTime = 0;

function cloneCached() {
    return ollamaStatusCache ? JSON.parse(JSON.stringify(ollamaStatusCache)) : null;
}

window.checkOllamaStatus = async function (options) {
    const force = options && options.force === true;
    const now = Date.now();
    if (!force && ollamaStatusCache && now - ollamaStatusCacheTime < OLLAMA_STATUS_TTL_MS) {
        return cloneCached();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags', {
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const offline = {
                online: false,
                installed: ollamaStatusCache ? ollamaStatusCache.installed : [],
                available: []
            };
            return JSON.parse(JSON.stringify(offline));
        }

        const data = await response.json();
        const installed = (data.models || []).map((m) => {
            const raw = String(m.model || m.name || '').replace(/^ollama:/, '');
            return {
                name: 'ollama:' + raw,
                size: m.size || 0
            };
        });

        ollamaStatusCache = {
            online: true,
            installed,
            available: []
        };
        ollamaStatusCacheTime = Date.now();
        return cloneCached();
    } catch (e) {
        clearTimeout(timeout);
        const offline = {
            online: false,
            installed: ollamaStatusCache ? ollamaStatusCache.installed : [],
            available: []
        };
        return JSON.parse(JSON.stringify(offline));
    }
};
