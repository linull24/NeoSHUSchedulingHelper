# Proposal: 2025-i18n-bootstrap

## Problem / Context
- 现有 UI 文案全部硬编码为中文，无法满足中/英或其他语言切换。
- SettingsPanel 里已有“最保守方案”需求，但缺少 i18n 基础设施（语言表、上下文、设置项）。

## Why
- 交付多语言版本，避免重复开发。
- 为后续 spec 约束提供落地点：所有新文案必须走 i18n key。

## What Changes
- `app/src/lib/i18n/`：新增 locale store、翻译 helper、默认语言配置。
- SettingsPanel：增加语言选择控件，使用 i18n key 渲染文案。
- 顶层布局（DockPanel/导航）开始使用 `t('common.x')`。
- Spec：记录 i18n 结构与 key 命名约定。
