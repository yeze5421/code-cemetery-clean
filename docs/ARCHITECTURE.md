# 模块化可插拔架构

代码墓地将“数据从哪里来”“什么算沉寂”“怎么写墓志铭”“怎么导出”拆为四种插件。每一类只依赖 `src/core/types.ts` 中的契约，业务组合由核心层完成，界面负责用户交互。

## 数据流

```text
React 界面
  │
  ├─ 扫描请求 ── 本地 HTTP API ── SourcePlugin ── Project[]
  │                                                │
  ├─ 领域服务 ←──── 合并、判定、墓志铭生成 ←───────────┘
  │      │
  │      ├─ DetectorPlugin → 状态
  │      └─ EpitaphPlugin → 文案
  │
  ├─ 保存状态 ── 本地存储适配层 ── .data/state.json
  │
  └─ ExporterPlugin ── 浏览器 Canvas ── PNG Blob
```

Node 侧读取文件系统和 GitHub 凭据；浏览器侧处理展示和绘图。来源插件不得被浏览器打包入口导入，因此文件系统与令牌不会随前端脚本发布。

桌面版复用同一界面、领域服务和插件，通过 `src/services/api.ts` 自动选择 `desktop/contracts.ts` 定义的受限 IPC 适配器。`desktop/main.ts` 是桌面组合入口：持久化使用系统账号的应用数据目录，本地来源显式注入随程序附带的 Git 路径，GitHub 来源显式注入经系统解密的令牌。桌面进程不启动 HTTP 服务；Web 模式仍使用原 HTTP 适配器。

`desktop/preload.ts` 只暴露读取、保存、扫描、目录选择、凭据状态/保存和 PNG 保存方法。界面没有原始文件系统、任意命令执行或 IPC 访问权限。主进程检查调用窗口、顶层 frame 和入口 URL；原生文件窗口负责用户选择，令牌单独加密，导出只允许 PNG。桌面运行机制详见 [DESKTOP.md](DESKTOP.md)。

## 目录职责

| 目录                     | 职责                                        |
| ------------------------ | ------------------------------------------- |
| `src/core/types.ts`      | 统一实体、设置与插件接口                    |
| `src/core/`              | 插件注册、状态分类、合并等纯领域服务        |
| `src/bootstrap.ts`       | 浏览器端插件组合入口，界面不直接导入插件实现 |
| `src/features/`          | 扫描、设置、详情、年度导出的展示组件       |
| `src/services/`          | API 客户端与串行保存队列                    |
| `src/plugins/sources/`   | 本地 Git 与 GitHub 数据读取                 |
| `src/plugins/detectors/` | 沉寂规则                                    |
| `src/plugins/epitaphs/`  | 本地墓志铭生成                              |
| `src/plugins/exporters/` | 导出文件的渲染实现                          |
| `src/data/`              | 明确标记的演示数据                          |
| `server/`                | HTTP 传输、输入校验、来源调度与 JSON 持久化 |
| `desktop/`               | 桌面主进程、隔离桥接、系统加密与输入策略 |
| `scripts/`               | 桌面构建、开发启动与隔离集成验证 |
| `tests/`                 | 领域和适配器的行为验证                      |

## 契约

所有插件包含 `id`、`name`、`description`、`version`、`kind`。`kind` 是判别字段。

```ts
interface SourcePlugin extends PluginMeta {
  kind: 'source';
  scan(options: ScanOptions): Promise<ScanResult>;
}

interface DetectorPlugin extends PluginMeta {
  kind: 'detector';
  classify(project: Project, settings: Settings, now?: Date): ProjectStatus;
}

interface EpitaphPlugin extends PluginMeta {
  kind: 'epitaph';
  generate(
    project: Project,
    style: EpitaphStyle,
    variant?: number,
  ): {
    epitaph: string;
    cause: string;
  };
}

interface ExporterPlugin extends PluginMeta {
  kind: 'exporter';
  export(options: ExportOptions): Promise<Blob>;
}
```

`Project` 保留真实的来源、日期、语言和提交数。无法取得提交数时使用 `null`，不能替换成 0。`status` 可以是 `buried`、`alive`、`revived`；`manualStatus` 表示用户主动选择了状态。`flowers` 和可编辑文案属于用户记录，重新扫描合并时应保留。

`ScanResult` 同时返回项目、扫描数量和警告，避免将限流、目录不可访问或达到扫描限制误说成完整结果。

## 增加一个插件

1. 在对应 `src/plugins/` 类别中新建实现，导出满足接口的对象。
2. 为插件选择稳定且唯一的 ID。浏览器插件在 `src/bootstrap.ts` 注册；来源插件注入 `createApp({ sources })` 或加入服务端默认来源列表。
3. 在插件设置中登记元数据与启用状态；来源插件由本地服务调度，导出插件由浏览器调度。
4. 针对插件的外部边界和失败情况添加测试。核心服务只面向接口，不增加具体插件的特殊分支。

例如 GitLab 来源只需实现 `SourcePlugin`，返回统一 `Project[]`；新的 HTML/SVG 导出器只需实现 `ExporterPlugin`，不必修改 Git 扫描器。当前采用编译时注册，而不是从互联网下载并运行任意插件代码。

同类插件按注册顺序选择第一个已启用的实现，界面通过统一契约调用。新来源还需扩展扫描表单的来源选项与输入字段；新导出格式需对应调整下载扩展名。保存队列按编辑顺序串行发送，扫描完成时以最新状态合并，保留扫描期间的编辑。

## 本地 API

| 方法 | 路径          | 输入 / 输出                                                  |
| ---- | ------------- | ------------------------------------------------------------ |
| GET  | `/api/health` | 服务状态                                                     |
| GET  | `/api/state`  | 当前 `AppState`                                              |
| PUT  | `/api/state`  | 经校验的 `AppState`，原子保存                                |
| POST | `/api/scan`   | `{ source, rootPath?, username?, maxDepth? }` → `ScanResult` |

开发模式由 Vite 代理 `/api` 至 4317 端口。生产模式由同一 Node 服务同时提供构建产物与 API。服务绑定 `127.0.0.1`，对写入及扫描请求检查主机和来源，避免任意外部网页调用本地文件扫描能力。

GitHub 令牌从 `process.env.GITHUB_TOKEN` 读取，绝不发往前端。程序启动时使用 `process.loadEnvFile()` 加载项目根目录的 `.env`（如存在），终端中已有的环境变量优先。公开用户扫描不要求令牌；私有仓库读取取决于身份和令牌权限。读取仅限 GitHub API，不下载仓库内容。

本地日期和提交数以当前 `HEAD` 可达历史为范围；不将其他分支的独有提交混入统计。GitHub 的出生日期为仓库 `created_at`，最后提交和提交数来自默认分支。提交历史读取失败时，提交数保留为 `null`，沉寂日期退回到仓库 `pushed_at`（没有推送日期时使用创建日期），同时向界面返回警告；该状态不能被理解为已验证的最后一次提交。

## 年度长图

`annualPngExporter.export({ year, ownerName, projects })` 返回 PNG `Blob`。其中 `year` 为具体年份或 `'all'`。

- 只选 `status === 'buried'` 的项目，按最后提交的 UTC 年份筛选，按时间由新到旧排列。
- 文案按 Canvas 实际字体宽度逐个字素测量，支持中文、换行与组合字符。卡片按完整文案计算高度。
- 画布宽度为 1080px；最长 30,000px。超限抛出可展示的中文错误，不静默丢弃项目。
- 出生日期、最后提交和提交数按源数据展示；未知数字明确标记。全部是演示数据时在页眉标记，每个演示项目也单独标记。
- 不嵌入文件路径或令牌。所有绘图在本地浏览器完成，没有远程图片导致的 Canvas 跨域污染。

`selectExportProjects()` 是纯筛选函数；`estimateExportDimensions()` 提供预览估计，实际导出尺寸由字体测量结果决定。

## 可验证性与后续扩展

时间通过可选的 `now` 注入检测器，便于测试阈值边界。源读取与领域计算分离，测试可以使用临时 Git 仓库、固定项目对象和模拟 HTTP 响应。PNG 的数据筛选由纯函数测试，字体及排版需要浏览器视觉验证。

以后可加入扫描任务队列、增量索引、更多来源、更多墓志铭语言或其他导出器。涉及 AI 的墓志铭可单独实现为新插件；当前默认版本完全使用本地规则，不要求模型服务。
