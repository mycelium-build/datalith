// The pre-paint theme bootstrap, shared by astro.config.ts (Starlight pages)
// and src/pages/index.astro. Kept as a string so it can be inlined verbatim.
export const themeInitScript = `(function () {
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
})();`;
