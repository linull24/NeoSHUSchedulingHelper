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
		'app-card': 'bg-[var(--app-color-bg)] rounded-[var(--app-radius-md)] shadow-soft'
	},
	transformers: [transformerDirectives()],
	safelist: [
		'bg-[var(--app-color-bg)]',
		'bg-[var(--app-color-bg-elevated)]',
		'text-[var(--app-color-fg)]',
		'border-[var(--app-color-border-subtle)]'
	]
});
