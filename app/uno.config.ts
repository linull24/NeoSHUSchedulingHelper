import { defineConfig, presetUno, presetWind, transformerDirectives } from 'unocss';

export default defineConfig({
	presets: [presetUno(), presetWind()],
	theme: {
		fontFamily: {
			sans: 'var(--app-font-family-sans)'
		},
		colors: {
			surface: 'var(--app-color-bg)',
			primary: 'var(--app-color-primary)',
			'primary-contrast': 'var(--app-color-on-primary)'
		},
		boxShadow: {
			soft: 'var(--app-shadow-soft)',
			hard: 'var(--app-shadow-hard)'
		},
		borderRadius: {
			sm: 'var(--app-radius-sm)',
			md: 'var(--app-radius-md)',
			lg: 'var(--app-radius-lg)',
			full: 'var(--app-radius-pill)'
		}
	},
	shortcuts: {
		'app-panel': 'bg-[var(--app-color-bg-elevated)] rounded-[var(--app-radius-lg)]',
		'app-card': 'bg-[var(--app-color-bg)] rounded-[var(--app-radius-md)] shadow-soft',
		'app-elevate-soft':
			'transform-gpu [filter:none] [transition:transform_var(--app-transition-fast),filter_var(--app-transition-fast)] hover:translate-y-[var(--app-elevation-active-translate-y)] hover:[filter:var(--app-elevation-active-filter)] focus-visible:translate-y-[var(--app-elevation-active-translate-y)] focus-visible:[filter:var(--app-elevation-active-filter)]',
		'app-elevate-strong':
			'transform-gpu [filter:none] [transition:transform_var(--app-transition-medium),filter_var(--app-transition-medium)] hover:translate-y-[var(--app-elevation-hover-translate-y)] hover:[filter:var(--app-elevation-hover-filter)] focus-visible:translate-y-[var(--app-elevation-hover-translate-y)] focus-visible:[filter:var(--app-elevation-hover-filter)]',
		'cal-unify': 'font-inherit text-inherit leading-inherit'
	},
	transformers: [transformerDirectives()],
	safelist: [
		'bg-[var(--app-color-bg)]',
		'bg-[var(--app-color-bg-elevated)]',
		'text-[var(--app-color-fg)]',
		'border-[var(--app-color-border-subtle)]'
	]
});
