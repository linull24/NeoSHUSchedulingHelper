# 数据处理流程（Download → Cache → CRUD → Hot/Cold → DuckDB-Wasm）

本文描述完整的数据处理链路，便于在 monorepo 内或独立部署时保持清晰的“取数→存储→加工→消费”逻辑。核心组件：

- `src/config/crawler.ts`：描述本地/远程 crawler 数据源。
- `src/lib/data/parsers/`：各学期 parser，将原始 JSON 转为 `InsaneCourseData`。
- DuckDB-Wasm：前端/调试层的分析数据库。

## 1. 下载（Download）

1. 读取 `getCrawlerConfig()` 获取当前源配置：
   - 本地模式：`<localRoot>/<termsDir>/<termId>.json`
   - 对象存储模式：`https://endpoint/bucket/prefix/<termId>.json`
2. 读取索引 `resolveIndexFile()` 或远程 `indexKey`，获知可用 term 列表与 hash/size。
3. 比较索引与本地缓存的 hash，决定是否重新拉取：
   - 本地缺失 -> 直接复制或软链接。
   - 远程 -> 下载到本地缓存目录（可使用 `tmp/<termId>.json` 再原子移动）。

## 2. 本地缓存（Cache）

缓存策略分两层：

- **原始快照缓存**：位于 `crawler/data/terms`（或 `CACHE_DIR/terms`），文件命名 `termId.json`。读取时优先本地缓存，若 hash 不符再触发下载。
- **解析结果缓存**：将 `InsaneCourseData` 或 DuckDB 二进制写入 `cache/parsed/<termId>.json`、`cache/duckdb/<termId>.db`. 这部分可通过文件 mtime + hash 快速判断是否需要重建。

缓存元数据建议写入 `cache/index.json`，记录 termId -> { rawHash, parsedHash, duckdbPath }。

## 3. CRUD 更新

解析流程中存在三种改写：

1. **原始数据 CRUD**：通常只读。但若需要手动修补，可：
   - 新建 `patches/<termId>/<issue>.json`， parser 在加载时合并（类似 override）。
   - 通过脚本修改 crawler 目录，并更新索引 `hash`。
2. **InsaneCourseData 扩展**：
   - Parser 输出后，可对 `course.sections` 做增删改（例如人工 override）。
   - 建议使用 `ScheduleOverride` 表达“删/改/移”，保持原始数据可追溯。
3. **DuckDB CRUD**：
   - 将课程/sections/scheduleChunks 写入表 `courses`, `sections`, `schedule`.
   - 若 UI 允许增删课程（临时规划），在 DuckDB 中维护 `draft_*` 表，并记录与原始 hash 的 diff。

## 4. 热/冷数据分层

| 层级     | 内容                               | 存储位置                          | 策略                              |
| -------- | ---------------------------------- | --------------------------------- | --------------------------------- |
| Hot      | 最近一到两个学期的 parsed JSON + DuckDB | `cache/parsed/latest/`, `cache/duckdb/latest/` | 启动时预加载到内存/DuckDB-Wasm   |
| Warm     | 当学年其余学期                     | `cache/archive/<year>/`           | 访问时按需加载，保留索引          |
| Cold     | 历史超过 N 年                      | 对象存储、压缩包或 Glacier       | 需要时按 hash 恢复                |

Hot 层可将 `InsaneCourseData` 序列化为二进制 (例如 msgpack)，初次加载即解压；同时将 DuckDB-Wasm 的数据库写入 IndexedDB 存储，避免重复构建。

## 5. DuckDB-Wasm 管道

1. **导入**：在解析完成后运行 `insertCourseRecords(db, dataset)`（待实现），将 `courses/sections/scheduleChunks/overrides` 写入内存表。
2. **查询**：
   - 冲突检测：`SELECT courseHash, day, period FROM schedule GROUP BY ... HAVING count(*) > 1`
   - 容量分析：`SELECT campus, SUM(capacity), SUM(vacancy) FROM courses GROUP BY campus`
   - Diff：将两个 term 的表 JOIN/EXCEPT 查差异。
3. **缓存**：
   - `AsyncDuckDB` 支持 `db.serialize()`，可将构建好的数据库写入 IndexedDB（浏览器）或 FS（Node）。
   - 对热数据，启动时先尝试载入缓存 DB；若 hash 不符再重建。
4. **热/冷切换**：当 term 不在 hot 列表，可延迟加载 DuckDB；若用户请求历史数据，再从对象存储拉取 .db 或 raw JSON 后生成。
5. **Fallback 策略**：若运行环境不支持 Wasm（旧浏览器、受限 worker），自动降级到：
   - Node/CLI：使用原生 DuckDB 或 SQLite（同一 schema）。
   - 浏览器：使用 IndexedDB + SQL.js（或自建轻量索引）完成查询。`getDuckDB()` 需捕捉错误并返回 fallback handle。

### Solver Result & Action Log 存储

- DuckDB/SQL.js 中除了课程查询，还要长期存放运行态表：
  ```sql
  CREATE TABLE selection_matrix_state (...); -- selection matrix snapshot
  CREATE TABLE action_log (...);             -- 操作日志
  CREATE TABLE solver_result (
    id TEXT PRIMARY KEY,
    desiredSignature TEXT,
    selectionSignature TEXT,
    solver TEXT,
    createdAt INTEGER,
    metrics JSON,
    assignment TEXT, -- base64 压缩的变量 -> 布尔值
    plan TEXT        -- base64 压缩的 ManualUpdate[]
  );
  ```
- `solver_result` 写入流程：solver 完成 → 按 assignment 生成“华容道”操作 plan → 将 metrics/assignments/plan encode(base64) 存在表里。UI 若需要展示候选方案，可直接从表中拉取最新记录，无需重新求解。
- gist 同步 (`syncStateBundle`) 会在下一阶段新增 `solver-result.jsonl`，用于跨设备恢复 solver 历史；数据量可控制在最近 N 条（例如 5 条）。
- Apply/Undo：用户点击“一键应用”会把 `plan` 提交给 `applyManualUpdatesWithLog`，将 `solverResultId` 写到 Action Log payload；撤销时根据 log 中的 `undo` 字段逆序执行，实现 solver result 的可回滚。
- Action Log 持久化：`action_log` 表必须包含 `dock_session`、`selection_snapshot`、`solver_result_id`、`default_target`、`override_mode`、`reverted_entry_id` 等列，并在写入时同步 `term` 字段，保证 gist / DuckDB 热加载后仍可按 session 回放。
- selection snapshot 数据沿用 `selectionPersistence` schema，在入库/同步前统一 gzip + base64，避免 GitHub bundle 膨胀。

## 6. 流程串联

1. **计划任务/脚本**：
   - 拉取索引 -> 下载缺失 term -> 更新缓存。
   - 调用对应 parser (`resolveParser(termName)`) 转成 `InsaneCourseData`。
   - 导入 DuckDB -> 序列化 -> 写入缓存。
2. **运行时**：
   - UI 请求 term -> 检查 parsed cache -> 若无，触发 parser。
   - 将 `InsaneCourseData` 送至前端（或 SSR） -> Dockable UI + consoles 可消费。
   - 若需要分析，加载 DuckDB-Wasm，导入/恢复数据库。

## 7. 需要进一步考虑的点

1. **一致性**：确保 raw hash/parsed hash/duckdb hash 一一对应；可将 hash 写入 DuckDB 表，与 dataset.meta 检查。
2. **权限**：若对象存储受限，缓存层需存储授权信息（令牌 TTL、刷新策略）。
3. **并发**：下载 & 解析 & DuckDB 构建需要加锁/幂等，避免多实例竞争。
4. **监控/日志**：为每个阶段记录指标（下载耗时、解析耗时、duckdb 构建耗时），方便故障排查。
5. **自动清理**：定期清理冷数据或配置 max cache size，避免磁盘膨胀。

## 8. 手动更新 & Issue 快捷流程

- `src/lib/data/manualUpdates.ts` 提供 `applyManualUpdates()`，支持四类操作：
  - `upsert-section`：新增/替换某教学班。
  - `remove-section`：删除异常教学班。
  - `add-override` / `remove-override`：追加或撤销临时规则。
- 函数会在内部复制 `InsaneCourseData.payload`，返回新的 `InsaneCourseData` 与 base64 编码版本信息（包含 seed/时间戳/更新数）。前端可将该 base64 存入日志或作为“手动修补版本号”。
- 在 Dockable 工作台或别的 UI，手动修改后提供“发 Issue”快捷按钮：将 `versionBase64`、更新摘要、termId 等自动填充到 Issue 模板，催促维护脚本在 crawler 仓库中补齐。

## 9. 冷数据的导入 / 导出

1. **导出**：热层或解析结果可定期归档：
   - `cache/parsed/<termId>.json` → `tar.gz` 后上传对象存储。
   - DuckDB `.db` 文件同样压缩，记录在索引 `size` 字段。
2. **导入**：当需要加载冷数据时：
   - 读取索引确认 hash。
   - 下载归档 → 校验 hash → 解压到冷数据缓存目录。
   - 通过 parser/duckdb 恢复成热数据；若仅使用 DuckDB，可直接载入 `.db`。
3. 建议 index.json 中附加 `storageClass`（如 `HOT`/`COLD`）与 `archiveKey`，以便自动决定 import/export 流程。

## 10. 已选/未选/待选课程存储策略

| 列表 | 作用 | 存储形式 | 备注 |
| --- | --- | --- | --- |
| **已选课程** | 驱动课表渲染、冲突检测 | 5×N `ClassTimeMatrix` + `versionBase64` | 只存 matrix +关联 sectionId，恢复 UI 时直接映射；任何增删操作都走 `ManualUpdate`，并触发 `versionBase64` 变更。 |
| **全部课程** | 权威数据源供筛选/搜索 | `InsaneCourseData.courses[]`（只读列表） | 不重复写入 DB，引用 parser 结果即可；筛选器只记录过滤条件或课程 hash，不复制整条记录。 |
| **我的待选** | 用户自建候选池 | `wishlistCourseIds: string[]` | 仅存课程 hash/sectionId 数组，需要详情时再去 `InsaneCourseData` 查；与 matrix 一并持久化，便于多端恢复。 |
| **求解结果 plan** | SAT 求解后的“华容道”操作 | `ManualUpdate[]`（顺序列表） | 作为 solver result 的一部分存进 `solver_result.plan`，apply/undo 时直接复用。 |
| **操作日志** | 记录手动和自动调整 | `ActionLogEntry[]`（append-only 列表） | 日志条目里携带 `undo: ManualUpdate[]`、dock session id、`selectionSnapshotBase64`（对覆盖操作），payload 中记录 `solverResultId`/plan/overrideMode 等元信息，支持在 UI 中恢复“求解→预览→覆盖/撤销”状态。 |
| **愿望/锁/软约束** | 求解输入 | `DesiredCourse[]` / `DesiredLock[]` / `SoftConstraint[]` | 都是直接罗列的 JSON 列表，字段在 `openspec/specs/desired-system/design.md`、`src/lib/data/desired/types.ts` 定义。 |
| **求解历史** | 回放/审计 solver | `solver_result` 表（列表） | 每次求解写一行，包含 metrics、assignment base64、plan base64。 |
| **JWXT 云端快照/操作** | 云端一致性与审计 | `jwxt_remote_snapshot`（可选）+ Action Log 的 `jwxt:*` entries | 不存储账号/密码/cookie/token；仅存 `{kch_id,jxb_id}` 列表、获取时间、以及 push diff/执行结果/补偿计划（best-effort undo）。 |

- 当用户做 CRUD 操作时：
  1. 更新 matrix（已选）并生成新的 `versionBase64`；
  2. 同步维护 `wishlistCourseIds`（待选列表）；
  3. 将“新增/删除”操作写入 `ManualUpdate` 列表，便于稍后发 Issue 或回放；
  4. 若切换到冷数据，先校验 `versionBase64`，不匹配时提示用户需要重新同步；
  5. **DB 持久化**：所有 matrix 与待选状态同时写入本地数据库（DuckDB/SQLite/IndexedDB），确保即使刷新或切换设备，也能通过 GitHub 登录读取最新状态。

## 11. GitHub 同步（单用户）

- **登录**：用户通过 GitHub OAuth（浏览器）授权后获得 token，用于：
  1. 读取/写入专用 Gist 中的备份文件（计划统一叫 `state-bundle.base64`）。
  2. 在 issue 中附带 `versionBase64` + log base64，方便脚本跟进。
- **环境变量**：前端/SSR 需配置
  - `PUBLIC_GITHUB_CLIENT_ID`：GitHub OAuth App 的 Client ID（暴露给前端即可）。
  - `GITHUB_CLIENT_SECRET`：同一 App 的 Client Secret，仅在服务端使用。
  OAuth 回调固定为 `/api/github/callback`，授权页由 `/api/github/login` 根据 `request.url.origin` 拼装，兼容 127.0.0.1 / 线上域名。
- **同步流程**：
  1. 本地 DB 每次变化 -> 写入 `action_log` + `selected_matrix` 表。
  2. 触发 `scheduleSync()`：将 termId/desired/selection/actionLog/solverResults（以及可选的 JWXT 云端快照元信息）打包成 JSON，base64 编码后写入 Gist (`state-bundle.base64`)。Action Log JSON 需要包含 `dockSessionId`、`solverResultId`、`defaultTarget`、`overrideMode`、`selectionSnapshotBase64` 等字段（以及 `jwxt:*` 的 diff/结果/补偿信息），供远端重现覆盖与云端副作用链路。
  3. 拉取最新云端数据时，解码 base64，先执行 `validateTermStateBundle()`（不变量 + 引用完整性 + 签名策略）。校验失败必须拒绝写入（no partial writes），并返回冲突信息或进入显式 merge 流程。
  4. 校验通过后再比较版本号/签名，不一致则提示用户合并/覆盖。
- **离线模式**：未登录 GitHub 时，所有数据保存在本地 DB；登录后再执行一次全量同步。
- **实现提示**：`src/lib/data/github/gistSync.ts` 负责 Gist 创建/更新 + token 认证，`syncStateBundle()` 已将 state bundle 封装为 base64 文件；未来若要“从 Gist 还原”，直接读取 `state-bundle.base64` 即可。

状态机合同入口（Selection/Solver/ActionLog/Sync/Cloud）见 `openspec/changes/UNDO-SM-1/design.md`。

## 12. Term 一等公民

- `config/term.ts` 统一管理 `currentTermId`、可选学期列表，CLI/UI 在初始化时指定 term。
- 本地状态（Desired/Selection/Action Log/Solver Result）均以 termId 为主键存储，`stateRepository` 的 CRUD 会自动按 term 读写；旧数据（未存 termId）会 fallback 到默认值。
- `termState.ts` 提供聚合加载能力：`loadTermState()`/`loadStateBundle()` 能一次拿到某学期的 desired/selection/action log/solver result，方便同步与调试。
- Gist bundle (`state-meta.json`) 附带 `termId`；`solver-result.jsonl` 与 action log 同步均按 term 维度切片，确保多学期并存。
