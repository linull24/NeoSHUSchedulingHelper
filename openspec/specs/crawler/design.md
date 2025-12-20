# Crawler 设计（Userscript-first + Node CI 生成 + SSG 消费）

为保证解析器能在 SSG（GitHub Pages / 静态站点）下稳定获取课表快照，本仓库把“爬取/快照生成”与“消费/展示”彻底解耦：

- **消费端（App runtime）**：只读取静态快照 `/crawler/data/**`（或配置的 remote URL），无依赖后端。
- **生成端（Crawler pipeline）**：优先 Userscript 与 Node（CI）路径，Python 仅 legacy 兜底。

Refs:
- `spec://core-mcp#chunk-01`
- `spec://cluster/jwxt#chunk-01`
- `spec://cluster/data-pipeline#chunk-01`

## 配置结构

```ts
interface CrawlerSourceConfig {
  id: string;             // 配置标识，便于日志和多源切换
  localRoot: string;      // 本地 crawler 仓库根目录
  termsDir: string;       // 学期 JSON 相对路径，如 data/terms
  indexFile: string;      // 索引文件相对路径，例如 data/terms/index.json
  remote?: {
    kind: 'object-storage';
    endpoint: string;     // S3/OSS/MinIO 等 Endpoint
    bucket: string;
    prefix?: string;      // 远程对象前缀，默认 terms/
    indexKey?: string;    // 索引对象 Key，默认 index.json
  };
}
```

默认值：

```ts
const DEFAULT_CONFIG = {
  id: 'local-monorepo',
  localRoot: path.resolve(import.meta.env?.VITE_CRAWLER_ROOT ?? '..', 'crawler'),
  termsDir: 'data/terms',
  indexFile: 'data/terms/index.json',
  remote: {
    kind: 'object-storage',
    endpoint: import.meta.env?.VITE_CRAWLER_REMOTE_ENDPOINT ?? 'https://storage.example.com',
    bucket: import.meta.env?.VITE_CRAWLER_REMOTE_BUCKET ?? 'shu-course-terms',
    prefix: 'terms/',
    indexKey: 'index.json'
  }
};
```

通过 `getCrawlerConfig(overrides)` 可按需覆盖字段，配合环境变量 `VITE_CRAWLER_ROOT` / `VITE_CRAWLER_REMOTE_*` 即可无侵入切换。

常用帮助函数：

- `resolveTermFile(termId)`：返回某个学期 JSON 的本地路径（例如 `crawler/data/terms/2025-16.json`）。
- `resolveIndexFile()`：返回索引文件路径，供 parser 或同步脚本读取。

## 索引规范（建议）

### `current.json`（round 索引，SSG 必需）

SSG 模式下，推荐维护 `app/static/crawler/data/current.json` 作为“当前学期+轮次索引”（由 CI/脚本自动生成）：

```jsonc
[
  {
    "termId": "2025-16--xkkz-<xkkzId>",
    "termCode": "2025-16",
    "jwxtRound": { "xkkzId": "<xkkzId>", "xklc": "2", "xklcmc": "第2轮" },
    "generatedAt": 1764847274263
  }
]
```

App 读取逻辑位于：`app/src/lib/data/catalog/cloudSnapshot.ts`。

### `terms/index.json`（可选）

为了在对象存储或多端环境快速枚举学期文件，仍可维护 `data/terms/index.json`（可选），结构如下：

```jsonc
[
  {
    "id": "2025-16",
    "file": "2025-16.json",
    "hash": "5e924c29bb03e4b7d03c9cd0d7493e2e",
    "updatedAt": 1764847274263,
    "size": 742311,
    "notes": "2025-2026 春"
  }
]
```

Parser 在启动时可读取索引，选择最新快照，也能与远程对象存储对齐（`bucket/prefix/file`）。

## 快照文件命名（round-stable）

为支持“一学期多轮次”，快照文件名以 `xkkzId` 为稳定键：

- `app/static/crawler/data/terms/<termCode>--xkkz-<xkkzId>.json`

同时，App 允许传入 `termCode`（例如 `2025-16`）并通过 `current.json` 解析到首选轮次，再激活到 `cloud.termSnapshot.v1:<termId>` 的本地缓存中。

## 生成路径（两条主路径）

### 1) Userscript（浏览器侧）

- 通过 GM XHR 直接访问 JWXT，复用浏览器 Cookie session。
- 产出一份符合 `RawCourseSnapshot` schema 的 JSON（包含 `jwxtRound` 与 `campusOptions`）。
- 适合本地手动刷新、调试、应急修复。

### 2) Node crawler（CI / server-side）

- 在 GitHub Actions 中运行（每次 deploy 或按需），使用 Secrets 的账号密码（或 cookie header）登录 JWXT。
- 写入 `app/static/crawler/data/current.json` 与 `app/static/crawler/data/terms/*.json`。
- 随后 `vite build` 把它们打包进 SSG 产物，作为 “cloud snapshot” 的默认来源。

> 备注：仓库内保留 `crawler/jwxt_crawler.py` 仅作历史参考，已弃用（不进入 CI/生产链路），未来将移除。

## 未来扩展

1. **多源热切换**：根据 termName 或 hash 指定不同 bucket/region。
2. **缓存策略**：在本地缓存对象存储结果，或通过 ETag/Last-Modified 做增量更新。
3. **鉴权**：若对象存储需要授权，可在配置中扩展 `credentials` 字段（如临时令牌/签名策略）。
4. **监控**：结合 `id` + `notes` 记录同步来源，方便 log/metrics 聚合。
