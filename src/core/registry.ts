import type { CemeteryPlugin, PluginMeta } from './types';

/** The host depends on this contract; plugins never import one another. */
export class PluginRegistry {
  private readonly plugins = new Map<string, CemeteryPlugin>();

  register<T extends CemeteryPlugin>(plugin: T): this {
    if (!plugin.id.trim()) throw new Error('插件必须有非空 ID');
    if (this.plugins.has(plugin.id)) throw new Error(`插件 ID 已注册：${plugin.id}`);
    const method = {
      source: 'scan',
      detector: 'classify',
      epitaph: 'generate',
      exporter: 'export',
    }[plugin.kind];
    if (!method || typeof (plugin as unknown as Record<string, unknown>)[method] !== 'function') {
      throw new Error(`插件接口不完整：${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
    return this;
  }

  get<T extends CemeteryPlugin = CemeteryPlugin>(id: string): T | undefined {
    return this.plugins.get(id) as T | undefined;
  }

  require<T extends CemeteryPlugin = CemeteryPlugin>(id: string): T {
    const plugin = this.get<T>(id);
    if (!plugin) throw new Error(`找不到插件：${id}`);
    return plugin;
  }

  list(kind?: PluginMeta['kind']): CemeteryPlugin[] {
    return [...this.plugins.values()].filter((plugin) => !kind || plugin.kind === kind);
  }
}
