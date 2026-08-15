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
			customCss: ['./src/styles/base.css', './src/styles/themes.css', './src/styles/starlight.css'],
			components: {
				ThemeSelect: './src/components/StarlightThemeSelect.astro',
			},
			head: [
				{
					tag: 'script',
					content: `(function () {
  var mode = 'light';
  var id = 'datalith-light';
  try {
    var raw = localStorage.getItem('datalith:theme');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed.mode === 'dark') mode = 'dark';
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mode = 'dark';
    }
    raw = localStorage.getItem('datalith:theme');
    if (raw) {
      var parsed = JSON.parse(raw);
      id = (mode === 'dark' ? parsed.dark : parsed.light) || id;
    }
  } catch (error) {
    /* ignore storage errors */
  }
  document.documentElement.dataset.datalithTheme = id;
  document.documentElement.dataset.mode = mode;
})();`,
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
