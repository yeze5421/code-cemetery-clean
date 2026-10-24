/** Composition root: the only browser module that imports concrete plugins. */
import { PluginRegistry } from './core';
import type { PluginMeta } from './core/types';
import { dormancyDetector } from './plugins/detectors/dormancy';
import { epitaphGenerator } from './plugins/epitaphs/humor';
import { annualPngExporter } from './plugins/exporters/annual-png';

export const browserRegistry = new PluginRegistry()
  .register(dormancyDetector)
  .register(epitaphGenerator)
  .register(annualPngExporter);

// Server-only source implementations stay outside the browser bundle.
export const sourceMetadata: PluginMeta[] = [
  {
    id: 'local-git',
    name: '本地 Git',
    version: '1.0.0',
    kind: 'source',
    description: '在指定目录中寻找 Git 项目，读取真实提交历史。',
  },
  {
    id: 'github',
    name: 'GitHub',
    version: '1.0.0',
    kind: 'source',
    description: '同步公开仓库；服务端配置令牌后可读取自己的私有仓库。',
  },
];
