# UI-REBOOT-2025 — 设计方案

## 1. 分层架构（对齐 `AGENTS.md`）

1. **Runtime Design Tokens**：同时引入 Fluent runtime tokens + mdui/MD3 动态色系统，仅负责算出
   `--accent-*`、`--md-sys-*` 等原始变量。
2. **Virtual Theme Layer**：我们唯一信任的语义 token 层，文件结构：
   - `tokens/_base.css`：声明 `--app-color-*`、`--app-radius-*`、`--app-text-*`……
   - `tokens/theme.fluent.css` / `tokens/theme.material.css` / `tokens/theme.terminal.css`（新增）：
     为 :root[data-theme="xxx"] 映射 `--app-*` → runtime token。
3. **UnoCSS Utility Layer**：仅负责布局/spacing/typography class；禁止写品牌色，禁止重复 token。
4. **Dockview Shell**：Svelte 组件 `DockWorkspace.svelte` 托管 Dockview 实例，提供 sticky header /
   filter slots，负责最小宽度与滚动策略（`horizontal scroll` 仅作兜底）。
5. **App Primitives**：`<AppButton>`, `<ListSurface>`, `<FilterBar>`, `<AppDialog>` 等抽象组件，
   只消费 `--app-*` tokens；借用 UnoCSS class 完成布局。
6. **Panels + Business Views**：All/Selected/Candidate/Solver/Settings/Calendar Panel 全部复用
   ListSurface 模板，业务逻辑纯 Svelte store + Dock slot，不触及 runtime token。

## 2. 规范重写范围

| Spec | 现状问题 | 重写方向 |
| --- | --- | --- |
| `openspec/specs/ui-templates/spec.md` | GoldenLayout 术语、SCSS token | 改写为 Dockview + UnoCSS slot 模板，列出 sticky/header/search/filter/footer slot 规则及 `--app-*` 依赖 |
| `openspec/specs/ui-issues/spec.md` | mixed 规则 | 合并为 Horizontal-scroll-last、Info priority、Ring owns capacity 等 Rule0~Rule6 |
| `openspec/specs/ui-course-cards/spec.md` | SCSS/legacy tokens | 使用 UnoCSS + CSS var，描述 capacity ring、halo、fallback degrade |
| `openspec/specs/ui-filters/spec.md` | 旧 filter bar | 重写 FilterBar slot、chip 行为、responsive auto-fit |
| `openspec/specs/dock-workspace/spec.md`（新增） | 无正式 spec | 定义 Dock shell、min-width、sticky、scrollbar 策略 |
| `openspec/specs/tokens/spec.md`（新增） | 无虚拟层 spec | 详述 Virtual Theme Layer 行为、runtime theme 切换 |

## 3. 前端实现策略

### 3.1 Tokens + UnoCSS
- 删除 `app/src/lib/styles/tokens/_legacy-shims.scss`，改用纯 CSS 文件，与 UnoCSS safelist 配置同步。
- UnoCSS 仅保留布局/typography preset，自定义规则用于 `bg-[var(--app-color-bg)]` 这类变量引用。
- 在 `app/src/app.html` / `app/src/routes/+layout.svelte` 控制 `<svelte:body data-theme={$theme}>`。

### 3.2 Primitives
- 新建 `app/src/lib/primitives/` 目录承载 App 级组件；每个组件自带 `README` + contracts。
- 所有按钮/input 使用语义 size/variant props，对应 UnoCSS class + CSS var。
- ListSurface 再细化 slot：`header-meta`, `header-actions`, `filters`, `filters-settings`, `body`, `footer`。
- FilterBar 提供 chips 区、自适应 columns；当宽度 < 320px 自动堆叠。

### 3.3 Dock Workspace
- 外层 `.workspace-root` 用 flex column + `min-h-screen`，Dockview 容器 `min-h-0`.
- 每个 Dock panel 包裹 `<DockPanelShell>` 提供 `min-width: clamp(320px, 35vw, 520px)`；当不可满足时 Dockview 自动 stack/scroll。
- Sticky 头部通过 CSS `position: sticky; top: 0; background: var(--app-color-bg);`.

### 3.4 Panels
- All/Selected/Candidate -> `<ListSurface>` + `<CourseCard>` + `<FilterBar>` + `<PaginationFooter>`.
- Solver Panel -> `<ListSurface>` header slot + solver controls grid（auto-fit columns）。
- Settings/Sync -> 采用 `<DockPanelShell>` + `<ListSurface>` + `<AppFormControl>` primitives。
- Calendar Panel -> `<ScheduleGrid>` 组件内部 grid，外层仍 flex/overflow auto。

### 3.5 实施顺序（前端几乎重写）
1. **兜底最小 UI**：先让 Minimal Workspace + Panel shell 保持可运行（即便是临时 UI），以便在大规模重写期间仍能测试业务逻辑。
2. **Primitives/UnoCSS**：在兜底 UI 上逐步接入 `tokens/_base.css`、主题映射、UnoCSS config，并实现 App 级 primitives。
3. **Dock shell**：完成 primitives 后，重写 `DockWorkspace`/`MinimalWorkspace`，确保 sticky/scroll/min-width 符合规范；旧面板可暂挂在新的 shell 上。
4. **面板迁移**：All → Selected → Candidate → Solver → Settings → Sync → Calendar 依次迁入 primitives，迁移时保留所有 store/逻辑函数。
5. **遗留清理**：完成迁移后删除旧 SCSS/token shims，跑 `npm run check` + `scripts/check_i18n.py all`，再进行 MCP UI 审查。

## 4. 数据/Store 协调

- Course selection/solver/action log store API 不变，但名称、类型、undo 行为要在 spec 中重写；
  i18n contract 强制使用键。
- 所有 store 写入/读取 tokens（如 theme store）必须经过 Virtual Layer 通道。

## 5. 验证流程

1. `npm run check`（含 SvelteKit typecheck）。
2. `scripts/check_i18n.py all`。
3. UnoCSS 构建（Vite dev/build）自检。
4. MCP UI 巡检：Dock workspace 滚动、capacity ring、FilterBar auto-fit。

## 6. 依赖/迁移

- Dockview 继续使用 `dockview-core`（版本≥4.x）。
- UnoCSS config 需更新 preset + safelist；若需额外插件（e.g. attributify），需在 design 中记录理由。
- 若需要临时 SCSS（如 keyframes），统一放在 `app/src/lib/styles/animations.css` 并引用 CSS 变量。

## 7. 交付物

- 重写后的 `openspec/specs/**` + memory chunk。
- 新 `app/src/lib/primitives/**`、`app/src/lib/apps/**`、`tokens/**`。
- 更新后的 docs（`AGENTS.md` 参考、设计文档）。
