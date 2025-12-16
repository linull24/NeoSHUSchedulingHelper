# Apply: UI-WIDE-1

## Summary
- 宽屏下，Settings/Sync/JWXT 面板使用 flex-wrap + min/max 宽度约束实现“自动拆分”，避免控件与文字过宽。
- DockIDE 不再尝试写死宽屏重排（避免固定 2x2 等布局）；宽屏利用主要依赖面板内部的响应式重排。

## Implementation
- `app/src/lib/apps/SettingsPanel.svelte`: 控制区块拆分为可换行的两列/多列布局（随容器宽度变化）。
- `app/src/lib/apps/SyncPanel.svelte`: Storage/Export/Import/Gist 区块拆分为可换行布局，并限制单卡片最大宽度。
- `app/src/lib/apps/JwxtPanel.svelte`: 连接/同步/检索/远端列表区块拆分为可换行布局，并限制单卡片最大宽度。
- `app/src/lib/components/DockIDE.svelte`: 移除“宽屏变体布局”的写死逻辑（保持 Dockview 手动布局语义）。

## Verification
- [x] `npm run check`（包含 `python3 scripts/check_i18n.py all`）

