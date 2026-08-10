// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://mycelium-build.github.io',
	base: process.env.SITE_BASE ?? '/',
	integrations: [
	starlight({
			title: 'Datalith',
			favicon: `${process.env.SITE_BASE ?? ''}/datalith.png`,
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/mycelium-build/datalith' }],
			sidebar: [
				{
					label: 'Datalith documentation',
					items: [{ autogenerate: { directory: 'vault' } }],
				},
			],
		}),
	],
});
