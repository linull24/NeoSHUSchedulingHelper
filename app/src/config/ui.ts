import { t } from '../lib/i18n';

export type ThemeId = 'material' | 'fluent';

export interface ThemeDefinition {
	id: ThemeId;
	label: string;
	description?: string;
}

export interface UIConfig {
	currentTheme: ThemeId;
	themes: ThemeDefinition[];
}

const DEFAULT_UI_CONFIG: UIConfig = {
	currentTheme: 'material',
	themes: [
		{
			id: 'material',
			label: 'Material Design 3',
			description: t('config.themes.materialDesc')
		},
		{
			id: 'fluent',
			label: 'Fluent 2',
			description: t('config.themes.fluentDesc')
		}
	]
};

export function getUIConfig(overrides?: Partial<UIConfig>): UIConfig {
	return {
		...DEFAULT_UI_CONFIG,
		...overrides,
		themes: overrides?.themes ?? DEFAULT_UI_CONFIG.themes
	};
}
