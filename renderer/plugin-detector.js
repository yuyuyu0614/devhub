(function () {
  let registry = null;
  let cache = null;
  let cacheTime = 0;
  const CACHE_TTL = 10000;

  async function loadRegistry() {
    if (registry) return registry;
    const resp = await fetch('plugin-registry.json');
    const data = await resp.json();
    registry = data.plugins;
    return registry;
  }

  async function checkOne(plugin) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const resp = await fetch(`http://127.0.0.1:${plugin.port}${plugin.endpoint}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      return { ...plugin, online: resp.ok };
    } catch (e) {
      clearTimeout(timeout);
      return { ...plugin, online: false };
    }
  }

  window.scanAllPlugins = async function (force) {
    if (!force && cache && (Date.now() - cacheTime < CACHE_TTL)) {
      return cache;
    }
    const plugins = await loadRegistry();
    const results = await Promise.all(plugins.map(p => checkOne(p)));
    cache = results;
    cacheTime = Date.now();
    return results;
  };

  window.scanPlugin = async function (pluginId) {
    const plugins = await loadRegistry();
    const plugin = plugins.find(p => p.id === pluginId);
    if (!plugin) return null;
    return checkOne(plugin);
  };
})();
