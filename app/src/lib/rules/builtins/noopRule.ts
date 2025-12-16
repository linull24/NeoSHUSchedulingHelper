import { t } from '../../i18n';
import type { Rule } from '../types';

export const noopRule: Rule = {
	id: 'noop',
	title: t('rules.noop.title'),
	description: t('rules.noop.description'),
	async apply() {
		return {
			id: 'noop',
			title: t('rules.noop.title'),
			severity: 'info',
			message: t('rules.noop.message')
		};
	}
};
