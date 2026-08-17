import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { themeInitScript } from './scripts/theme-init.ts';

// https://astro.build/config
export default defineConfig({
	site: 'https://mycelium-build.github.io',
	base: process.env.SITE_BASE ?? '/',
	integrations: [
		starlight({
			title: 'Datalith',
			favicon: `${process.env.SITE_BASE ?? ''}/datalith.png`,
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/mycelium-build/datalith' }],
			customCss: ['./src/styles/base.css', './src/styles/themes.css', './src/styles/starlight.css'],
			components: {
				ThemeSelect: './src/components/StarlightThemeSelect.astro',
			},
			head: [
				{
					tag: 'script',
					content: themeInitScript,
				},
			],
			sidebar: [
				{
					label: 'Datalith documentation',
					items: [{ autogenerate: { directory: 'vault' } }],
				},
			],
		}),
	],
});
