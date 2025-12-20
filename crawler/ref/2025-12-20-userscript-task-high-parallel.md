# Userscript Task API: High Parallel Mode (2025-12-20)

> 目的：在 **userscript 模式**下，加速“云端/本地调试”之外的重操作（例如爬取快照、轮次解析）。
> 注意：这里记录的是 **脱敏** 的 console 调用方式，不包含任何账号/密码/cookie。

## 任务 API

Userscript backend 暴露：

- `__jwxtUserscriptBackend.taskStart(request)`
- `__jwxtUserscriptBackend.taskGet(taskId)`
- `__jwxtUserscriptBackend.taskStop(taskId)`
- `__jwxtUserscriptBackend.taskList()`

其中 `request` 需要包含：

- `kind`: 任务类型（见下）
- `poll`: 轮询参数（可选；用于“持续检查直到成功/用户停止”）
- `parallel`: 并行参数（可选；用于“高并行抓取”）

## 新增任务类型

### 1) `jwxt_crawl_snapshot`（高并行爬取快照）

默认高并行（concurrency=16），可覆盖：

```js
const started = await __jwxtUserscriptBackend.taskStart({
  kind: 'jwxt_crawl_snapshot',
  termId: undefined,       // 可选：用于校验学期是否匹配
  limitCourses: undefined, // 可选：限量抓取（debug用）
  parallel: { concurrency: 24 } // 1..32
});
started
```

轮询读取状态：

```js
const id = started.task.id;
await __jwxtUserscriptBackend.taskGet(id);
```

停止：

```js
await __jwxtUserscriptBackend.taskStop(id);
```

### 2) `jwxt_parallel_rounds`（并行解析轮次元数据）

用于加速每个 round tab 的 Display 页抓取（拿到稳定的 `xklc/xklcmc`）：

```js
const started = await __jwxtUserscriptBackend.taskStart({
  kind: 'jwxt_parallel_rounds',
  parallel: { concurrency: 6 } // 1..16
});
await __jwxtUserscriptBackend.taskGet(started.task.id);
```

## 备注

- userscript 默认并行度与“是否在 selectable 检查中自动抓人数明细”来自编译期配置：
  - `app/static/backenduserscript/userconfig/config.json`
  - `app/static/backenduserscript/userconfig/local.json`（可选，gitignored）
- `poll.enabled=true` 适合 “持续检查直到满足条件（可选）/用户手动 stop” 的场景；
- `parallel.concurrency` 适合 “下载页数/抓取快照加速” 的场景；
- 并行过高可能触发 JWXT 限流（429/5xx）；建议在 UI 里做可配置上限（policy/setting 层），并在任务结果里提示重试策略。
