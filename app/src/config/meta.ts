import { base } from '$app/paths';

export interface MetaLink {
	id: string;
	labelKey: string;
	href: string;
}

export interface MetaLinkGroup {
	id: string;
	titleKey: string;
	links: MetaLink[];
}

export interface AboutMetaConfig {
	descriptionKey: string;
	groups: MetaLinkGroup[];
}

export interface BrandingMetaConfig {
	iconSrc: string;
	iconAltKey: string;
}

export interface AppMetaConfig {
	productNameKey: string;
	productBylineKey: string;
	homepage: string;
	branding: BrandingMetaConfig;
	about: AboutMetaConfig;
}

const DEFAULT_META_CONFIG: AppMetaConfig = {
	productNameKey: 'meta.productName',
	productBylineKey: 'meta.productByline',
	homepage: 'https://xk.shuosc.com',
	branding: {
		iconSrc: `${base || ''}/icons/shuosc.png`,
		iconAltKey: 'meta.productIconAlt'
	},
	about: {
		descriptionKey: 'settings.aboutDesc',
		groups: [
			{
				id: 'project',
				titleKey: 'settings.aboutProjectGroup',
				links: [
					{
						id: 'github-home',
						labelKey: 'settings.aboutGithubRepo',
						href: 'https://github.com/shuosc/shu-scheduling-helper'
					}
				]
			},
			{
				id: 'feedback',
				titleKey: 'settings.aboutFeedbackGroup',
				links: [
					{
						id: 'github-issues',
						labelKey: 'settings.aboutGithubIssues',
						href: 'https://github.com/shuosc/shu-scheduling-helper/issues'
					},
					{
						id: 'tencent-support',
						labelKey: 'settings.aboutTencentSupport',
						href: 'https://support.qq.com/products/120502'
					}
				]
			}
		]
	}
};

export function getMetaConfig(overrides?: Partial<AppMetaConfig>): AppMetaConfig {
	return {
		...DEFAULT_META_CONFIG,
		...overrides,
		branding: {
			...DEFAULT_META_CONFIG.branding,
			...(overrides?.branding ?? {})
		},
		about: {
			...DEFAULT_META_CONFIG.about,
			...(overrides?.about ?? {}),
			groups: overrides?.about?.groups ?? DEFAULT_META_CONFIG.about.groups
		}
	};
}
