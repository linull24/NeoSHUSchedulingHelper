# 2025-12-19 Localhost JWXT API E2E Notes (Chrome MCP)

> Purpose: keep a **traceable**, **sanitized** record of running JWXT flows through the local dev server
> (`http://localhost:5173/` → `/api/jwxt/*`) for regression testing.
>
> No credentials/cookies/tokens are included (per `spec://cluster/jwxt#chunk-01`).

## 1) What was tested

- Environment: local dev server at `http://localhost:5173/`
- Caller: browser console (executed via Chrome MCP `evaluate_script`)
- Flow:
  1) `GET /api/jwxt/status`
  2) `POST /api/jwxt/login` (credentials **not** logged)
  3) `GET /api/jwxt/rounds`
  4) `POST /api/jwxt/select-round`
  5) `POST /api/jwxt/search` (query by course code)
  6) `POST /api/jwxt/enroll` (real side effect)
  7) `POST /api/jwxt/drop` (rollback side effect)
  8) `POST /api/jwxt/sync` (verify selected list)

## 2) Console script (sanitized)

```js
async function api(path, body) {
  const res = await fetch(`/api/jwxt/${path}`, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: HTTP_${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function jwxtE2E() {
  console.log('status', await api('status'));

  // Do NOT hardcode credentials in console history
  const userId = prompt('JWXT userId');
  const password = prompt('JWXT password');
  console.log('login', await api('login', { userId, password }));

  const rounds = await api('rounds');
  console.log('rounds', rounds);
  const xkkzId = rounds.rounds?.find(r => r.active)?.xkkzId || rounds.activeXkkzId || rounds.rounds?.[0]?.xkkzId;
  if (xkkzId) console.log('select-round', await api('select-round', { xkkzId }));

  const search = await api('search', { query: '00815248' });
  console.log('search', search);
  const pick = search.results?.[0];
  if (!pick?.kchId || !pick?.jxbId) throw new Error('NO_PICKABLE_RESULT');

  console.log('enroll', await api('enroll', { kchId: pick.kchId, jxbId: pick.jxbId, courseName: pick.courseName }));
  console.log('drop', await api('drop', { kchId: pick.kchId, jxbId: pick.jxbId }));
  console.log('sync', await api('sync', {}));
}

jwxtE2E();
```

Notes:

- `sync` is **POST** (`POST /api/jwxt/sync`), not GET.
- The course code `00815248` is only an example; any reachable course is fine.

## 3) Bugs found during E2E and fixes

### 3.1 `GET /api/jwxt/rounds` returned 502: `tabs=0`

- Symptom: some term-system deployments render no `<li>` round tabs; only hidden fields exist, causing rounds discovery to fail.
- Fix: `parseSelectionIndexHtml()` now falls back to hidden fields to synthesize a single round tab.
  - File: `app/shared/jwxtCrawler/selection.ts`
  - Server endpoint now uses the shared parser: `app/src/routes/api/jwxt/rounds/+server.ts`
  - Userscript `rounds()` now also fetches each Display page to extract `xklc/xklcmc` meta consistently (not only active tab):
    - File: `app/static/backenduserscript/src/index.ts`

### 3.2 `POST /api/jwxt/enroll` returned 400: `"无操作权限！"`

- Root cause: server-side `buildEnrollUrl()` missed `?gnmkdm=...`, producing a URL that JWXT treats as unauthorized.
- Fix: `buildEnrollUrl()` and `buildDropUrl()` now always attach `gnmkdm` query param.
  - Files:
    - `app/src/lib/server/jwxt/selectionContext.ts`
    - `app/src/lib/data/jwxt/selectionContext.ts`

### 3.3 Batch policy (★ user batch) moved to policy-only gating

- Goal: enforce “批次底线” without scattering logic across panels/solver; cloud snapshots stay user-agnostic.
- Implementation:
  - TermState now keeps a **USER-SPECIFIC runtime cache** `jwxt.userBatchCache` keyed by `kchId::jxbId` (★ marker derived by userscript backend).
    - File: `app/src/lib/data/termState/types.ts`
    - Schema: `app/src/lib/data/termState/schema.ts`
    - Repair: `app/src/lib/data/termState/repair.ts`
  - The actual blocking decision is enforced by an **edge policy module** (so UI cannot bypass it):
    - `app/src/lib/policies/instances/shu/edge/modules/jwxtEnrollMinBatch.ts`
  - UI (`JwxtPanel`) only does:
    - fetch breakdown (userscript)
    - cache `userBatch`
    - dispatch `JWXT_ENROLL_NOW` (blocked by edge policy if needed)
    - File: `app/src/lib/apps/JwxtPanel.svelte`

## 5) Local CI-like crawler run (sanitized)

This is the same entry used by GitHub Actions (SSG bundled output), but run locally:

```bash
npm --prefix app run crawl:jwxt
```

Expected outputs (paths only; no secrets):

- `app/static/crawler/data/current.json`
- `app/static/crawler/data/terms/<termId>.json`
- `app/static/crawler/data/terms/batchdata/<termId>.json` (user-agnostic stats)

## 4) Final result (after fixes)

- `rounds ✅` (single round is returned even when tabs are absent)
- `enroll ✅` then `drop ✅` (no leftover enrollment)
- `sync ✅` returns selected list
