# Cluster: Data Pipeline — Memory Staging

## spec://cluster/data-pipeline#chunk-01
Context: `openspec/specs/data-pipeline/spec.md` Purpose + first requirement (lines 1-18).
Contract:
- Term 数据必须遵循“下载 → 缓存 → 解析 → DuckDB/JSON”流程，覆盖 hot/warm/cold 层；raw/parsed/DuckDB artifact 都要有 hash。
- 当 term cache 与索引 hash 不符时，重新抓取 raw snapshot、解析成 `InsaneCourseData`，并更新 DuckDB/SQL.js。
State:
- crawler 索引（hash/size）驱动 refresh；缓存目录分 raw (`crawler/data/terms`) 与 parsed (`cache/parsed`, `cache/duckdb`).
Edge:
- 禁止直接改 raw 文件；必须更新索引并重新构建缓存。
Links:
- `openspec/specs/data-pipeline/spec.md:1-18`

## spec://cluster/data-pipeline#chunk-02
Context: `openspec/specs/data-pipeline/spec.md` lines 19-26.
Contract:
- CRUD/override 必须分层记录（patches、ScheduleOverride、DuckDB draft 表），确保可追踪；应用 patch 后更新 hash/metadata。
- Query 层要求 DuckDB-Wasm 首选，若环境不支持需 fallback 到 SQLite/SQL.js，但 schema/功能保持一致。
State:
- `patches/<termId>/` + override merges；DuckDB fallback handle 由 `getDuckDB()` 管理。
Edge:
- 未在 metadata 中记录 patch 就改写 raw 视为违规；fallback 必须保留冲突检测能力。
Links:
- `openspec/specs/data-pipeline/spec.md:19-26`

## spec://cluster/data-pipeline#chunk-03
Context: `openspec/specs/data-pipeline/design.md` sections 1-3（Download/Cache/CRUD）。
Contract:
- 下载流程：读取 crawler config → compare hash → 拉取/复制 term JSON，存入 `crawler/data/terms`（raw）和 `cache/index.json`。
- 缓存层：raw 快照 + parsed/DuckDB 缓存，记录 hash/mtime；解析结果可写 `cache/parsed/<term>.json`、`cache/duckdb/<term>.db`。
- CRUD 层：raw patch（patches/term/issue.json）→ parser merge；InsaneCourseData 扩展→ prefer ScheduleOverride；DuckDB 增删改→ `draft_*` 表记录 diff。
State:
- 统一 `cache/index.json` 记录 termId -> {rawHash, parsedHash, duckdbPath}；脚本 `resolveParser(term)` 负责 parser 选择。
Edge:
- 缺少 hash/mtime 会导致重复解析；禁止直接改 `cache/duckdb` 不更新索引。
Links:
- `openspec/specs/data-pipeline/design.md:1-48`

## spec://cluster/data-pipeline#chunk-04
Context: 同 design 文档 sections 4-5（热/冷分层 + DuckDB-Wasm pipeline）。
Contract:
- 数据分 Hot/Warm/Cold 层：热层预加载常用 term（json+duckdb），warm 按需加载，cold 存远端并按 hash 恢复。
- DuckDB-Wasm 管道：解析后导入 courses/sections/schedule/overrides 表→支持冲突/容量/diff 查询；支持 serialize() 写入 IndexedDB 或 FS。
- 当环境不支持 Wasm，需降级到原生 DuckDB/SQLite/SQL.js，仍提供同 schema。
State:
- Hot 层可用 msgpack/IndexedDB；`AsyncDuckDB` + fallback handle 负责加载/降级。
Edge:
- 不得在 cold 层直接查询；必须恢复到 hot/warm 缓存后再供 UI 使用。
Links:
- `openspec/specs/data-pipeline/design.md:48-120`

## spec://cluster/data-pipeline#chunk-05
Context: design 文档中 “Solver Result & Action Log 存储” 小节。
Contract:
- DuckDB/SQL.js 必须存 `selection_matrix_state`, `action_log`, `solver_result`（base64 assignment/plan）表；solver run 完成后写 metrics + plan。
- `syncStateBundle` 需包含 `solver-result.jsonl`，限制最近 N 条；Action Log 写入 `solverResultId`, `dock_session`, `selection_snapshot`, `default_target`, `override_mode`, `reverted_entry_id`。
- Selection snapshot 需遵循 `selectionPersistence` schema + gzip base64。
State:
- Apply/undo 流程依赖 `applyManualUpdatesWithLog`；Action Log + solver_result 连接 dock preview。
Edge:
- 如果 solver_result 不写 base64 plan，则无法回放；Action Log 缺失 dock/session 字段 breaking UI。
Links:
- `openspec/specs/data-pipeline/design.md:120-170`

## spec://cluster/data-pipeline#chunk-06
Context: design sections 6-11（流程串联、手动更新、冷数据导入、存储策略、GitHub 同步）。
Contract:
- 脚本 orchestrations：索引→下载→解析→导入 DuckDB→序列化缓存；运行时按需触发 parser/DB 载入。
- 手动更新 API（applyManualUpdates）负责 upsert/remove/override，同时生成 `versionBase64` 供 issue template；Dock 提供“发 Issue”按钮。
- 冷数据导出/导入需记录 hash/storageClass，导入时校验 hash。
- 存储策略表（selected/wishlist/plan/logs/...）规定字段与持久化方式；GitHub sync 通过 `state-bundle.base64` 传递 termId + desired/selection/actionLog/solver result。
- OAuth 配置：`PUBLIC_GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`，回调 `/api/github/(login|callback)`。
State:
- `scheduleSync()` 打包数据→Gist；`gistSync.ts` 负责 API；离线模式本地 DB。
Edge:
- 如果 versionBase64 不随手动更新变化，云端合并会冲突；冷数据导入未校验 hash 可能污染缓存。
Links:
- `openspec/specs/data-pipeline/design.md:170-210`

## spec://cluster/data-pipeline#chunk-07
Context: design section 12（Term 一等公民）+ cross references。
Contract:
- 所有状态（desired/selection/action log/solver result）按 termId 存储；`termState.ts` 提供 `loadTermState()`/`loadStateBundle()`，Gist bundles 也附 termId。
- `config/term.ts` 管理当前 term + 列表，CLI/UI 初始化必须选 term；旧数据 fallback 到默认 term 但需提示更新。
- solver-result/action-log 同步都要分 term 切片，确保多学期共存。
State:
- stateRepository CRUD 以 termId 分区；`state-meta.json` 在 Gist 中记录 term 信息。
Edge:
- 未提供 termId 的状态视为 legacy，需要迁移脚本；禁止混用不同 term 的 selection 数据。
Links:
- `openspec/specs/data-pipeline/design.md:210-220`
