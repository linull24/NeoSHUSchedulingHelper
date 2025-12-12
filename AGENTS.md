```markdown
# AGENTS Operating Guide – UI Rebuild 2025

> **Status：** 完全重写前端。  
> 旧的前端除了少量业务交互逻辑 / 类型定义外，**一律视为废弃参考，不要复用 UI 代码、样式和布局**。  
> 目标：构建一套「Runtime Tokens + Virtual Theme Layer + UnoCSS + Dockview」驱动的 Svelte UI。

本文件面向两类参与者：

- **人类开发者**
- **LLM Agent（包括通过 MCP 接入的 Svelte / mdui 文档服务）**

任何自动修改前端代码的动作，都必须满足本文件约束。

---

## 0. 名词约定 & 非包说明

- **flex / grid**
  - 指 **CSS 布局模型**（`display: flex` / `display: grid`），**不是 npm 包，也不是框架**。
  - 在代码中通过 UnoCSS 原子类使用：`flex`, `flex-col`, `items-center`, `grid`, `grid-cols-*` 等。

- **Runtime Tokens**
  - 指由第三方库在 **运行时** 通过 JS 算出来并写入 `document` 的 CSS 自定义属性（CSS variables），用于颜色、层级、对比度等。

- **Virtual Theme Layer**
  - 项目自定义的、统一的设计系统语义层：所有 UI 代码只认 `--app-*` 这套变量，不直接使用 Fluent / MD3 原生 token 名。

---

## 1. 技术栈一览（新前端）

### 1.1 语言 / Runtime

- TypeScript
- Svelte 5 + SvelteKit（路由 / SSR / hydration / endpoints）
- Node 18+ 或 Bun（本地开发 / SSR）

### 1.2 前端框架 & 布局引擎

- **Svelte + SvelteKit**
- **Docking 布局：`dockview-core`**
  - npm 包：`dockview-core`
  - 用于 IDE 风格的 Panel / Tab / Split 布局，是唯一允许的 docking 引擎。

### 1.3 样式与布局

- **原子 CSS 引擎：UnoCSS**
  - npm 包：
    - `unocss`
    - `@unocss/vite`（通过 Vite 插件集成）
  - 用途：
    - 布局：`flex`, `flex-col`, `items-center`, `justify-between`, `gap-x-2`, `gap-y-3`…
    - 尺寸：`h-screen`, `h-9`, `min-h-0`, `min-w-0`, `w-full`…
    - 滚动：`overflow-auto`, `overflow-hidden`…
    - 响应式：`sm:`, `md:`, `lg:` 前缀。

- **CSS 布局策略**
  - **全局、Shell、面板容器、列表等：只使用 CSS Flex 布局。**
  - **只有在封装组件内部（如课程表）才能使用 CSS Grid。**

### 1.4 Runtime Design Tokens 引擎

> 这些库只负责「算 token + 注入 CSS 变量」，不作为直接 UI 组件库使用。

- **Fluent UI Runtime Tokens**
  - npm 包：`@fluentui/web-components`
  - 用法：通过 Fluent Design System / DesignToken API 初始化：
    - 设定 `accentColor`, `neutralColor`, 亮暗模式等；
    - 在运行时计算出 `--accent-*`, `--neutral-*` 等 Fluent token。

- **Material 3 / mdui Runtime Tokens**
  - npm 包：`mdui`（v2，基于 MD3 的 Web Components / Dynamic Color）
  - 用法：用 mdui 提供的 MD3 动态色 API 生成：
    - `--md-sys-color-*`, `--md-ref-palette-*`, `--md-sys-typescale-*` 等 MD3 token。

### 1.5 文档 MCP

> Agent 必须使用这些文档源，而不是凭“记忆”瞎猜 API。

- **Svelte 文档 MCP**
  - npm 包：`@sveltejs/mcp`
  - 启动：`npx -y @sveltejs/mcp`（stdio MCP server）

- **mdui 文档 MCP**
  - npm 包：`@mdui/mcp`
  - 启动：`npx -y @mdui/mcp`（stdio MCP server）

> 推荐在 `.cursor/mcp.json` / `.vscode/mcp.json` / Copilot config 中统一配置：
>
> ```jsonc
> {
>   "mcpServers": {
>     "svelte": { "command": "npx", "args": ["-y", "@sveltejs/mcp"] },
>     "mdui":   { "command": "npx", "args": ["-y", "@mdui/mcp"] }
>   }
> }
> ```

---

## 2. 完整架构分层

从下到上：

1. **Runtime Tokens 层（多源）**
2. **Virtual Theme Layer（`--app-*` 语义 tokens）**
3. **UnoCSS 工具层（布局 / spacing / responsive）**
4. **Dockview Shell + Panel 容器**
5. **UI Primitives（`App*` 组件）**
6. **业务 Panels（All / Selected / Candidate / Solver / Settings / Sync / Calendar 等）**

### 2.1 Runtime Tokens 层（底层）

- Fluent runtime & mdui runtime 同时在页面初始化：

  - Fluent：
    - 通过 `@fluentui/web-components` 提供的设计系统接口设置：
      - 基础主色 `accentColor`
      - 中性色 `neutralColor`
      - 明暗模式 / 对比度策略
    - 得到一组 Fluent CSS 变量：`--accent-fill-rest`, `--accent-fill-hover`, `--neutral-layer-1`, `--neutral-foreground-1` 等。

  - mdui / MD3：
    - 通过 mdui 的 MD3 Dynamic Color 能力（seed color / image）设置：
      - 生成 `--md-sys-color-primary`, `--md-sys-color-surface`, `--md-sys-color-on-primary` 等。

- **禁止行为：**
  - 业务层 / App 组件直接引用 `--accent-*` / `--neutral-*` / `--md-sys-*` 等变量。

### 2.2 Virtual Theme Layer（唯一语义层）

> 所有上层 UI 只允许使用 `--app-*` 变量，这些变量由 Virtual Theme Layer 映射到底层 Runtime Tokens。

目录约定：

```text
src/lib/design-system/tokens/
  _base.css            # 定义语义 token 名
  theme.fluent.css     # data-theme='fluent' 时的映射
  theme.material.css   # data-theme='material' 时的映射
  theme.<extra>.css    # 未来可选：terminal / high-contrast 等
```

* `_base.css` 定义：
  ```css
  :root {
    --app-color-bg:            #050508;
    --app-color-bg-elevated:   #0b0f19;
    --app-color-fg:            #f9fafb;
    --app-color-primary:       #2563eb;
    --app-color-primary-hover: #1d4ed8;
    --app-color-border-subtle: #1f2933;

    --app-radius-sm: 4px;
    --app-radius-md: 6px;
    --app-radius-lg: 10px;

    --app-text-xs: 0.75rem;
    --app-text-sm: 0.875rem;
    --app-text-md: 1rem;
  }
  ```
* `theme.fluent.css`：
  ```css
  :root[data-theme='fluent'] {
    --app-color-bg:            var(--neutral-layer-1);
    --app-color-bg-elevated:   var(--neutral-layer-2);
    --app-color-fg:            var(--neutral-foreground-1);
    --app-color-primary:       var(--accent-fill-rest);
    --app-color-primary-hover: var(--accent-fill-hover);
    --app-color-border-subtle: var(--neutral-stroke-1);

    --app-radius-md: 4px;
  }
  ```
* `theme.material.css`：
  ```css
  :root[data-theme='material'] {
    --app-color-bg:            var(--md-sys-color-surface);
    --app-color-bg-elevated:   var(--md-sys-color-surface-container-high);
    --app-color-fg:            var(--md-sys-color-on-surface);
    --app-color-primary:       var(--md-sys-color-primary);
    --app-color-primary-hover: color-mix(in srgb, var(--md-sys-color-primary) 90%, black);
    --app-color-border-subtle: color-mix(in srgb, var(--md-sys-color-outline-variant) 70%, transparent);

    --app-radius-md: 12px;
  }
  ```

**硬性约束（Contract A）：**

1. 任何 Svelte 组件 / CSS 文件中， **只允许使用 `--app-*` tokens** 。
2. 不允许业务代码直接写 `--accent-*` / `--neutral-*` / `--md-sys-*` / `--md-ref-*` 等底层 tokens 名。
3. 修改底层映射只在 `theme.*.css` 内完成。

### 2.3 UnoCSS 层（布局 / spacing）

* UnoCSS 负责所有「可读性较强的工具类」：
  * 布局：`flex`, `flex-col`, `items-center`, `justify-between`, `gap-x-2`, `gap-y-2`…
  * 尺寸：`h-screen`, `h-9`, `w-full`, `min-h-0`, `min-w-0`…
  * 滚动：`overflow-auto`, `overflow-hidden`…
  * 响应式：`sm:*`, `md:*`, `lg:*`。

**硬性约束（Contract B）：**

* 不再引入 Tailwind / Bootstrap 之类 CSS 框架。
* 普通 CSS / SCSS 不得再硬编码颜色 / 圆角 / 字体大小 / 间距等（这些全部通过 `--app-*` + UnoCSS 解决）。

---

## 3. 布局策略：Flex Only + 封装 Grid

### 3.1 flex / grid 的职责

* **flex** ：所有 Shell / Panel 容器 / 列表 / 工具栏 / 设置页的默认布局方式；当 Dockview 挤压导致空间不足时，必须配合 ResizeObserver + 组件包装（如 `ResponsiveSwitch`）自动切换到「小号/紧凑布局」，而不是在同一布局里硬撑。
* **grid** ：仅用于「真正的二维矩阵」场景（例如课程表），并且必须封装在专用组件内部。

### 3.2 Shell & Panel 容器示例

```svelte
<!-- AppShell.svelte -->
<svelte:body
  data-theme={$theme}
  class="bg-[var(--app-color-bg)] text-[var(--app-color-fg)] font-sans"
>
  <div class="h-screen flex flex-col">
    <header class="h-11 flex items-center justify-between px-4
                   border-b border-[color:var(--app-color-border-subtle)]">
      ...
    </header>

    <main class="flex-1 min-h-0 flex">
      <aside class="hidden lg:flex w-56 flex-col border-r
                     border-[color:var(--app-color-border-subtle)]">
        ...
      </aside>

      <section class="flex-1 min-w-0 min-h-0">
        <DockIDE />
      </section>
    </main>
  </div>
</svelte:body>
```

### 3.3 Grid 封装规则

* 把课程表等真二维场景封装为独立组件，例如 `ScheduleGrid.svelte`：
  ```svelte
  <!-- ScheduleGrid.svelte（内部可以使用 grid） -->
  <div class="grid grid-cols-[80px,repeat(7,1fr)] auto-rows-[64px] gap-px">
    <slot />
  </div>
  ```
* 业务 Panel 内只使用 `<ScheduleGrid>`，不直接写 `display: grid` 或 `grid-*`。

**硬性约束（Contract C）：**

1. 业务 Panel（All/Selected/Candidate/Solver/Settings/Sync/Calendar 等）内，布局只能使用 CSS flex。
2. 如需使用 grid，必须新建 / 复用独立的封装组件（如 `ScheduleGrid`），并在其中实现 grid 细节。
3. LLM / Agent 不得在业务 Panel 中直接生成 `display: grid` 或 UnoCSS 的 `grid-*` 类。

---

## 4. UI Primitives（`App*` 组件层）

所有业务 UI 必须通过 primitives 使用。

### 4.1 组件列表（初始目标）

* `AppButton`
* `AppIconButton`
* `AppInput`
* `AppSelect`
* `AppToggle`
* `AppTabs` / `AppTab`
* `AppDialog`
* `AppCard`
* `ListSurface`（列表容器）
* `FilterBar`
* `PaginationFooter`
* `DockPanelShell`（面板通用外壳，含 header + body）

### 4.2 基本实现规范

示例：`AppButton.svelte`

```svelte
<script lang="ts">
  export let variant: 'primary' | 'secondary' = 'primary';
  export let size: 'sm' | 'md' = 'md';
  const $$restProps = $props();
</script>

<button
  class={`inline-flex items-center justify-center
          ${size === 'sm' ? 'h-7 px-3 text-[var(--app-text-xs)]' : 'h-8 px-3 text-[var(--app-text-sm)]'}
          rounded-[var(--app-radius-md)]
          border border-[color:var(--app-color-border-subtle)]
          transition-colors duration-150
          ${variant === 'primary'
            ? 'bg-[var(--app-color-primary)] text-[var(--app-color-bg)] hover:bg-[var(--app-color-primary-hover)]'
            : 'bg-[var(--app-color-bg-elevated)] hover:bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_90%,#000)]'}`}
  {...$$restProps}
>
  <slot />
</button>
```

**硬性约束（Contract D）：**

1. Panel / 业务代码中只允许使用 `App*` 组件 + 原生 HTML（配合 UnoCSS），不直接使用 Fluent/mdui 原生组件。
2. 如需要借用 Fluent/mdui 的复杂组件（如 DatePicker / Menu），必须封装为 `AppDatePicker` / `AppMenu`，在内部集成，并在 docs 中写明行为。

---

## 5. Dockview Shell / Workspace

### 5.1 唯一 docking 引擎：`dockview-core`

* npm 包：`dockview-core`。
* 封装成 Svelte 组件，例如 `DockIDE.svelte`，内部统一管理：
  * Docker root 容器；
  * panel 注册 / 打开 / 关闭；
  * 布局持久化。

### 5.2 Shell 结构约定

* Shell 只负责：
  * sticky header；
  * 主体区域 flex 布局；
  * Dock 容器 `min-h-0`, `min-w-0`, `overflow-hidden`。

**硬性约束（Contract E）：**

1. 不要再引入 GoldenLayout 或其他 docking 库。
2. 若 Agent 认为“某库更好用”，必须忽略，继续使用 `dockview-core` 并完善现有封装。

---

## 6. 业务 Panels（全重写）

旧前端 UI  **不再复用** ，仅保留少量业务逻辑 / store / 类型定义。Panel UI 全部重写为：

* Svelte + UnoCSS + `App*` primitives + Dockview。

目标 Panel 包括但不限于：

* `AllPanel`
* `SelectedPanel`
* `CandidatePanel`
* `SolverPanel`
* `SettingsPanel`
* `SyncPanel`
* `CalendarPanel`

**硬性约束（Contract F）：**

1. 禁止从旧前端复制任何 HTML/SCSS/布局代码。
2. 可以复用：
   * 业务 store / 类型；
   * 接口调用函数；
   * 已经验证正确的算法/工具函数。
3. Panel 的 UI 设计必须遵守本文件其它约束（Runtime Tokens、Virtual Theme、flex-only 等）。

---

## 7. Agent 使用 MCP 的要求

### 7.1 Svelte 相关任务

* 当 Agent 要做以下事情时，必须优先使用 `@sveltejs/mcp` 提供的工具：
  * Svelte 语法 / runes / store / 组件生命周期；
  * SvelteKit 路由 / load 函数 / 表单操作；
  * Svelte 特有的 SSR / hydration 行为。

**流程：**

1. 使用 `svelte` MCP 的文档工具（如 `list-sections` / `get-documentation`）查官方文档。
2. 生成/修改 Svelte 代码后，调用 `svelte-autofixer` 直到无报错。

### 7.2 mdui / MD3 相关任务

* 涉及：
  * mdui 组件；
  * MD3 动态色配置；
  * `--md-sys-*` tokens；
  * mdui 提供的动画 / 交互样式。

**流程：**

1. 使用 `mdui` MCP 文档工具查找对应组件 / token；
2. 如需修改 runtime token 初始化逻辑，应遵循官方推荐使用方式。

---

## 8. 开发流程 / Checklist（简版）

### 新增一个 Panel 的步骤（Agent & 人类通用）

1. 定义 Panel 的  **数据需求 / store 接口** （只涉及业务逻辑，不碰 UI）。
2. 在 `src/lib/ui/primitives/` 中确认需要的 `App*` 组件是否齐全，不够则先补齐。
3. 在 `src/lib/panels/` 下创建 Panel 组件：
   * 外壳：`class="w-full h-full flex flex-col"`
   * 头部：`header` 使用 flex + `App*`；
   * 主体：`section` 为 `flex-1 min-h-0 overflow-auto`，内部使用 primitives 和 flex（如需网格表格则封装 grid 组件）。
4. 将 Panel 挂到 Dockview Shell（`DockIDE.svelte`）中，通过注册 panel 类型 / 打开时注入 props。
5. 使用 Virtual Theme Tokens / UnoCSS 类对齐视觉规范，不写任何硬编码颜色。
6. 跑 `npm run check` 等检查及基本端到端验证。

---

## 9. 禁止事项总表（Do NOT）

* ❌ 把 `flex` / `grid` 当成 npm 包或框架来安装或 require。
* ❌ 在业务代码中直接使用 Fluent / MD3 原生 CSS 变量，如：
  * `var(--accent-fill-rest)`、`var(--md-sys-color-primary)` 等。
* ❌ 在 Panel 中直接使用 CSS Grid / UnoCSS `grid-*` 类（必须通过封装组件）。
* ❌ 引入任意新的 CSS/布局框架（Tailwind / Bootstrap / Chakra / MUI 等）。
* ❌ 复制旧前端的 HTML / SCSS / 布局代码。
* ❌ 在普通 CSS/SCSS 里硬编码颜色 / 圆角 / 字体大小 / 间距。

---

如有新约束（例如某些 Panel 需要特例布局、某主题需要额外 token），请在本文件末尾追加章节，并在 PR 描述中显式提及，便于 Agent 读取到最新规则。
