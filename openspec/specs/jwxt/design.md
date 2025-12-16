# JWXT Integration Design (Cloud Ops + Undo)

## 1. Cloud vs Local
JWXT 是外部系统：本地 Selection/Solver 状态可以完全回滚，但 JWXT 的真实选退课只能通过“补偿动作”尽力回到之前的状态（best-effort）。

因此，JWXT 相关状态被拆分为：
- **Local planning**：只改本地 selection（`selection:*`），不触发云端。
- **Cloud execution**：触发 JWXT enroll/drop（`jwxt:*`），必须可审计、可预览、可补偿。

## 2. Data Model (Minimal)

```ts
interface JwxtSelectedPair {
  kchId: string;
  jxbId: string;
}

interface JwxtPushPlan {
  toEnroll: JwxtSelectedPair[];
  toDrop: JwxtSelectedPair[];
}

type JwxtCloudStatus = 'ok' | 'partial' | 'failed' | 'drift';

interface JwxtActionPayload {
  kind: 'jwxt';
  phase: 'sync' | 'preview' | 'apply' | 'undo';
  cloudStatus: JwxtCloudStatus;
  plan?: JwxtPushPlan;
  result?: {
    enrolled: JwxtSelectedPair[];
    dropped: JwxtSelectedPair[];
    failed: Array<{ op: 'enroll' | 'drop'; pair: JwxtSelectedPair; reason: string }>;
  };
  cloudUndoPlan?: JwxtPushPlan; // 最小补偿计划（通常为成功项的反向操作）
}
```

## 3. Transitions

### 3.1 Sync from Remote
`jwxt:sync-from-remote`：
- 拉取 JWXT 已选对列表；
- 映射到本地 `courseCatalog`/`sectionId`（映射失败进入 unmapped 列表，不得静默丢失）；
- 写入本地 selection（或仅写入“待处理计划”，由用户确认落地）；
- 记录 Action Log（携带必要摘要与回滚路径）。

### 3.2 Push Preview → Push Apply
- `jwxt:push-preview`：dryRun 计算 diff（`plan`），用于 UI 展示确认，不改远端。
- `jwxt:push-apply`：用同一份 selection snapshot 执行真实 enroll/drop，并记录 `result` + `cloudUndoPlan`。

### 3.3 Undo (Compensation)
- `jwxt:undo`：基于 `cloudUndoPlan` 发起反向请求（best-effort）。
- 若失败：进入 `cloudStatus='drift'`，UI 必须提示重新 sync。

## 4. Safety Notes
- 任何云端写操作必须先预览 diff，并在执行前做安全校验（例如 `kch_id`/`courseCode` 映射异常时拒绝执行，见 `JWXT-SYNC-1`）。
- 日志与同步 bundle 不得包含凭据；只存可复现的 diff/结果/补偿计划。

## 5. Contract Links
- Action Log schema/undo: `openspec/specs/action-log/spec.md`
- Term-State invariants: `openspec/changes/UNDO-SM-1/design.md`

